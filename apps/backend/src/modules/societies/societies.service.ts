import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Society } from '@prisma/client';
import type { AdminSocietyDetailDto, CreateSocietyBody, UpdateSocietyBody } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { generateInviteCode } from './invite-code';

/** How many times a generated invite code may clash before we give up (31^8 codes: never, in practice). */
const CODE_ATTEMPTS = 5;

export const WITH_COUNTS = { _count: { select: { residents: true, rounds: true } } } as const;
export type SocietyWithCounts = Society & { _count: { residents: number; rounds: number } };

/**
 * Societies: tenant binding from invite codes, and the super-admin's Societies screens
 * (FEAT-032, ADR-0043). Every cross-tenant method here is reached only through the
 * SUPER_ADMIN-guarded admin controller.
 */
@Injectable()
export class SocietiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The society a code admits to. An inactive society's code admits nobody (FEAT-035,
   * ADR-0045 §4): every door answers "unknown code", exactly as for a code that never
   * existed, and residents already signed in keep their sessions.
   */
  async findByInviteCode(inviteCode: string): Promise<Society | null> {
    const society = await this.prisma.society.findUnique({ where: { inviteCode } });
    return society?.active ? society : null;
  }

  findById(id: string): Promise<Society | null> {
    return this.prisma.society.findUnique({ where: { id } });
  }

  /**
   * Every society, ordered by name, for the super-admin (FEAT-005), with its resident and
   * round counts (FEAT-032). This is the explicit cross-tenant read.
   */
  async listAll(): Promise<AdminSocietyDetailDto[]> {
    const rows = await this.prisma.society.findMany({
      include: WITH_COUNTS,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toDetail);
  }

  /** One society with its counts, or 404. */
  async getDetail(id: string): Promise<AdminSocietyDetailDto> {
    const row = await this.prisma.society.findUnique({ where: { id }, include: WITH_COUNTS });
    if (!row) throw notFound();
    return toDetail(row);
  }

  /** Create a society with a server-generated invite code (retried on the rare clash). */
  create(body: CreateSocietyBody): Promise<AdminSocietyDetailDto> {
    return this.withFreshCode(async (inviteCode) =>
      toDetail(
        await this.prisma.society.create({
          data: { name: body.name, city: body.city, inviteCode },
          include: WITH_COUNTS,
        }),
      ),
    );
  }

  /** Rename or move a society. The invite code is untouched (see {@link rotateInviteCode}). */
  async update(id: string, body: UpdateSocietyBody): Promise<AdminSocietyDetailDto> {
    await this.getDetail(id);
    const row = await this.prisma.society
      .update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
        include: WITH_COUNTS,
      })
      .catch(goneIsNotFound);
    return toDetail(row);
  }

  /**
   * Replace the invite code (ADR-0043 §2): the old code stops working at once; residents who
   * already joined are bound by `societyId`, not by the code, so they are unaffected.
   */
  async rotateInviteCode(id: string): Promise<AdminSocietyDetailDto> {
    await this.getDetail(id);
    return this.withFreshCode(async (inviteCode) =>
      toDetail(
        await this.prisma.society
          .update({ where: { id }, data: { inviteCode }, include: WITH_COUNTS })
          .catch(goneIsNotFound),
      ),
    );
  }

  /**
   * Delete an EMPTY society (ADR-0043 §3). A society cascades to its residents, rounds,
   * offerings and pledges, so one with any residents or rounds is refused with 409. The
   * check and the delete share a transaction so a resident joining in between cannot be
   * swept away with it.
   */
  async remove(id: string): Promise<{ deleted: true }> {
    await this.prisma
      .$transaction(
        async (tx) => {
          const row = await tx.society.findUnique({ where: { id }, include: WITH_COUNTS });
          if (!row) throw notFound();
          if (row._count.residents > 0 || row._count.rounds > 0) {
            throw new ConflictException({
              code: ErrorCode.CONFLICT,
              message: `This society has ${row._count.residents} resident(s) and ${row._count.rounds} round(s); only an empty society can be deleted.`,
            });
          }
          await tx.society.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((err: unknown) => {
        // V2 P3: a resident joining mid-delete aborts the serializable transaction (P2034).
        // That is the "not empty" answer, so say 409 rather than a 500.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'The society changed while deleting it. Reload and try again.',
          });
        }
        throw err;
      });
    return { deleted: true };
  }

  private async withFreshCode<T>(write: (inviteCode: string) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await write(generateInviteCode());
      } catch (err) {
        const clash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!clash || attempt >= CODE_ATTEMPTS) throw err;
      }
    }
  }
}

/** V2 P3: a society deleted between the read and the write is a 404, not a 500 (Prisma P2025). */
function goneIsNotFound(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw notFound();
  throw err;
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Society not found.' });
}

export function toDetail(row: SocietyWithCounts): AdminSocietyDetailDto {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    inviteCode: row.inviteCode,
    active: row.active,
    residentCount: row._count.residents,
    roundCount: row._count.rounds,
    createdAt: row.createdAt.toISOString(),
  };
}
