import { Injectable } from '@nestjs/common';
import { RoundStatus } from '@prisma/client';
import { Role, type AdminOverviewDto } from '@bulk/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toDetail, WITH_COUNTS } from '../societies/societies.service';
import { waitingAskGroups } from '../rounds/service-asks.query';
import { RESIDENT_ROW, toResidentDto } from './residents-admin.service';

const RECENT = 5;

/** The admin console's opening numbers (FEAT-034): one round trip for the dashboard header. */
@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AdminOverviewDto> {
    const [societies, users, admins, openRounds, recentSocieties, recentUsers, waiting] = await Promise.all([
      this.prisma.society.count(),
      this.prisma.resident.count(),
      this.prisma.resident.count({ where: { role: Role.SUPER_ADMIN } }),
      this.prisma.round.count({ where: { status: RoundStatus.OPEN } }),
      this.prisma.society.findMany({ include: WITH_COUNTS, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: RECENT }),
      this.prisma.resident.findMany({ include: RESIDENT_ROW, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: RECENT }),
      waitingAskGroups(this.prisma),
    ]);
    return {
      societies,
      users,
      admins,
      openRounds,
      waitingAsks: waiting.length,
      recentSocieties: recentSocieties.map(toDetail),
      recentUsers: recentUsers.map(toResidentDto),
    };
  }
}
