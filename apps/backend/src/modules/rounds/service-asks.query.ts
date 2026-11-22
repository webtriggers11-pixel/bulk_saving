import { RoundStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

/** One society+service pair residents are waiting on, with its ask count and timing. */
export interface WaitingAskGroup {
  societyId: string;
  serviceId: string;
  askCount: number;
  since: Date;
  latest: Date;
}

/**
 * The asks an admin can act on (FEAT-022, ADR-0033; BUG-029). A pair counts when it has no
 * open round and the society still offers an active service (otherwise "Open a round" would
 * 400). Newest first by the latest ask: this is a to-do list, and a brand-new request must
 * not sort under weeks-old ones (BUG-029).
 *
 * Reads the 100 most recently asked pairs. If more than that many are waiting, older pairs
 * wait for the next look, which is acceptable for a to-do list (V2 r2 P3).
 */
export async function waitingAskGroups(prisma: PrismaService): Promise<WaitingAskGroup[]> {
  const ranked = await prisma.serviceAsk.groupBy({
    by: ['societyId', 'serviceId'],
    _count: { _all: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
    orderBy: [{ _max: { createdAt: 'desc' } }, { societyId: 'asc' }, { serviceId: 'asc' }],
    take: 100,
  });
  if (ranked.length === 0) return [];
  const pairs = ranked.map((g) => ({ societyId: g.societyId, serviceId: g.serviceId }));
  const [openRounds, offered] = await Promise.all([
    prisma.round.findMany({ where: { status: RoundStatus.OPEN, OR: pairs }, select: { societyId: true, serviceId: true } }),
    prisma.serviceOffering.findMany({
      where: { enabled: true, service: { active: true }, OR: pairs },
      select: { societyId: true, serviceId: true },
    }),
  ]);
  const key = (p: { societyId: string; serviceId: string }) => `${p.societyId}|${p.serviceId}`;
  const open = new Set(openRounds.map(key));
  const ok = new Set(offered.map(key));
  return ranked
    .filter((g) => ok.has(key(g)) && !open.has(key(g)))
    .map((g) => {
      const latest = g._max.createdAt ?? new Date();
      return { societyId: g.societyId, serviceId: g.serviceId, askCount: g._count._all, since: g._min.createdAt ?? latest, latest };
    });
}
