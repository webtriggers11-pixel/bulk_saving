import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoundStatus } from '@prisma/client';
import {
  normalisePhone,
  Role,
  type AdminResidentDetailDto,
  type CreateAdminBody,
  type AdminResidentDto,
  type AdminResidentsQuery,
  type Page,
  type UpdateResidentBody,
} from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { containsInsensitive, searchTerm } from '../../common/list-filters';
import { pageArgs, pageOf } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

/** A pledge counts while its round is not cancelled: those are the rows a removal would orphan. */
const LIVE_PLEDGE = {
  round: { status: { not: RoundStatus.CANCELLED } },
} satisfies Prisma.RoundParticipantWhereInput;

export const RESIDENT_ROW = {
  society: { select: { id: true, name: true } },
  _count: { select: { roundParticipations: { where: LIVE_PLEDGE } } },
} satisfies Prisma.ResidentInclude;
type Row = Prisma.ResidentGetPayload<{ include: typeof RESIDENT_ROW }>;

/**
 * Every resident, across every society, for the super-admin (FEAT-033, ADR-0044) — the
 * second explicit cross-tenant read after the societies list. Reached only through the
 * SUPER_ADMIN-guarded admin controller.
 */
@Injectable()
export class ResidentsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(query: AdminResidentsQuery = {}): Promise<Page<AdminResidentDto>> {
    const q = searchTerm(query.q);
    // V2 P3: a term that is all spaces/dashes leaves an empty phone fragment, which would match everyone.
    const phoneTerm = q?.replace(/[\s-]/g, '') ?? '';
    const where: Prisma.ResidentWhereInput = {
      ...(q
        ? {
            OR: [
              { name: containsInsensitive(q) },
              ...(phoneTerm ? [{ phone: { contains: phoneTerm } }] : []),
            ],
          }
        : {}),
      ...(query.societyId ? { societyId: query.societyId } : {}),
      ...(query.role ? { role: query.role } : {}),
      // FEAT-035: active or inactive accounts only.
      ...(query.status ? { active: query.status === 'active' } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.resident.findMany({
        where,
        include: RESIDENT_ROW,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.resident.count({ where }),
    ]);
    return pageOf(rows, query, total, toResidentDto);
  }

  /**
   * Rename, change a role, or switch an account on/off (ADR-0044 §3, ADR-0045 §2–3). An admin
   * cannot change their own role or switch themselves off, and the last ACTIVE admin can be
   * neither demoted nor switched off: either would lock the admin door (ADR-0023). The checks
   * and the write share a serializable transaction, so two admins acting on each other at once
   * cannot both succeed. Switching an account off ends every one of its sessions.
   */
  async update(actorId: string, id: string, body: UpdateResidentBody): Promise<AdminResidentDto> {
    let switchedOff = false;
    const dto = await this.prisma
      .$transaction(
        async (tx) => {
          const current = await tx.resident.findUnique({ where: { id } });
          if (!current) throw notFound();
          const lastActiveAdmin = async () =>
            current.role === Role.SUPER_ADMIN &&
            current.active &&
            (await tx.resident.count({ where: { role: Role.SUPER_ADMIN, active: true } })) <= 1;
          if (body.role !== undefined && body.role !== current.role) {
            // FEAT-036 (ADR-0046 §3): a RESIDENT must belong to a society; a platform admin has none.
            if (current.societyId === null)
              throw conflict('A platform admin has no society, so they cannot become a resident. Remove or switch them off instead.');
            if (id === actorId)
              throw conflict('You cannot change your own role. Ask another admin.');
            if (await lastActiveAdmin())
              throw conflict('This is the last admin. Make someone else an admin first.');
          }
          // V2 P1: no self change to `active` in either direction. Switching yourself back on was
          // the hole: a switched-off admin's still-valid token could undo the switch-off.
          if (body.active !== undefined && body.active !== current.active && id === actorId) {
            throw conflict(body.active ? 'You cannot switch yourself back on. Ask another admin.' : 'You cannot switch yourself off.');
          }
          if (body.active === false && current.active) {
            if (await lastActiveAdmin())
              throw conflict('This is the last active admin and cannot be switched off.');
            switchedOff = true;
          }
          const row = await tx.resident.update({
            where: { id },
            data: {
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(body.role !== undefined ? { role: body.role } : {}),
              ...(body.active !== undefined ? { active: body.active } : {}),
            },
            include: RESIDENT_ROW,
          });
          return toResidentDto(row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch(raceOutcome);
    if (switchedOff) await this.auth.revokeAllSessions(id);
    return dto;
  }

  /**
   * Create a platform admin: SUPER_ADMIN with no society (FEAT-036, ADR-0046 §3). Refused when
   * the phone already has a society-less account, and when it belongs to a resident: making a
   * resident an admin is a role change on their row (ADR-0044), not a second account.
   */
  async createAdmin(body: CreateAdminBody): Promise<AdminResidentDto> {
    const phone = normalisePhone(body.phone);
    if (!phone) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'phone must be a valid phone number.' });
    }
    const existing = await this.prisma.resident.findFirst({
      where: { phone },
      orderBy: [{ societyId: { sort: 'asc', nulls: 'first' } }],
      include: { society: { select: { name: true } } },
    });
    if (existing?.societyId === null) throw conflict('This number is already a platform admin.');
    if (existing) {
      throw conflict(
        `This number belongs to a resident of ${existing.society?.name ?? 'a society'}. Open them in Users and make them an admin instead.`,
      );
    }
    try {
      const row = await this.prisma.resident.create({
        data: { phone, name: body.name ?? null, role: Role.SUPER_ADMIN, societyId: null },
        include: RESIDENT_ROW,
      });
      return toResidentDto(row);
    } catch (err) {
      // The partial unique index (ADR-0046 §1): a concurrent create with the same phone.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw conflict('This number is already a platform admin.');
      throw err;
    }
  }

  /** One user with every pledge they made, newest first (FEAT-035). */
  async detail(id: string): Promise<AdminResidentDetailDto> {
    const row = await this.prisma.resident.findUnique({ where: { id }, include: RESIDENT_ROW });
    if (!row) throw notFound();
    const pledges = await this.prisma.roundParticipant.findMany({
      where: { residentId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        units: true,
        paymentCollectedAt: true,
        createdAt: true,
        round: {
          select: { id: true, status: true, deadline: true, service: { select: { name: true } } },
        },
      },
    });
    return {
      ...toResidentDto(row),
      pledges: pledges.map((p) => ({
        roundId: p.round.id,
        serviceName: p.round.service.name,
        status: p.round.status as RoundStatus,
        units: p.units,
        paid: p.paymentCollectedAt !== null,
        deadline: p.round.deadline.toISOString(),
        joinedAt: p.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Remove a resident (ADR-0044 §5). Refused for yourself, for the last admin, and for anyone
   * with a pledge in a round that is not cancelled: the schema would cascade the pledge away
   * without RoundService adjusting the round's unit count. Their sessions end at once.
   */
  async remove(actorId: string, id: string): Promise<{ deleted: true }> {
    if (id === actorId) throw conflict('You cannot remove yourself.');
    await this.prisma
      .$transaction(
        async (tx) => {
          const current = await tx.resident.findUnique({ where: { id }, include: RESIDENT_ROW });
          if (!current) throw notFound();
          if (
            current.role === Role.SUPER_ADMIN &&
            current.active &&
            (await tx.resident.count({ where: { role: Role.SUPER_ADMIN, active: true } })) <= 1
          ) {
            throw conflict('This is the last admin and cannot be removed.');
          }
          const pledges = current._count.roundParticipations;
          if (pledges > 0) {
            // V2 P2: any pledge outside a cancelled round blocks removal, closed and delivered ones
            // included. Deleting would cascade away that round's units, payments and rating history
            // (ADR-0044 §5). Deactivating keeps the history and still ends their access.
            throw conflict(
              `This resident has ${pledges} pledge(s) in group buys. Removing them would erase that history, so deactivate them instead.`,
            );
          }
          await tx.resident.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch(raceOutcome);
    await this.auth.revokeAllSessions(id);
    return { deleted: true };
  }
}

/**
 * V2 P2: a race answers 404/409, never a 500. A serializable abort (P2034) means another
 * admin changed the same rows mid-check; a missing row (P2025) means it was deleted between
 * the read and the write.
 */
function raceOutcome(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2034')
      throw conflict('Another admin changed this user at the same moment. Reload and try again.');
    if (err.code === 'P2025') throw notFound();
  }
  throw err;
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Resident not found.' });
}

function conflict(message: string): ConflictException {
  return new ConflictException({ code: ErrorCode.CONFLICT, message });
}

export function toResidentDto(row: Row): AdminResidentDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role as Role,
    active: row.active,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    society: row.society ? { id: row.society.id, name: row.society.name } : null,
    pledgeCount: row._count.roundParticipations,
  };
}
