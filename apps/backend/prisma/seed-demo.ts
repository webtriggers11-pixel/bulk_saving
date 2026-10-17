/**
 * CHORE-018 demo seed — residents, vendors, and a round in EVERY lifecycle state, so
 * each screen (resident and admin) has something real to draw. Layered on top of the
 * base seed (`seed.ts`), which must run first; `pnpm --filter backend seed:demo` does both.
 *
 * Re-running RESETS the demo: every round whose id starts with `demo_` is deleted
 * (cascading its participants, ratings and notifications) and recreated as written
 * here, and its BullMQ close + reminder jobs are replaced — the app's schedulers keep
 * a pending job as-is, so a stale one from a previous seed would close the fresh round
 * at the OLD deadline. Residents are upserted and never deleted.
 *
 * Dev only: refuses NODE_ENV=production, and any DATABASE_URL that is not localhost
 * unless ALLOW_DEMO_SEED=1 — it rewrites the role of whoever owns the demo phones.
 *
 * The rows obey the same rules RoundsService enforces (ADR-0010, ADR-0011, ADR-0012):
 * `unitsCount` is the sum of participant units, CLOSED_MET/EXPIRED follows the lowest
 * threshold, assigned rounds carry a vendor + finalPrice, RATED has ratings and
 * DELIVERED has none. Notifications are seeded SENT so the outbox never dispatches them.
 */
import { NotificationType, PrismaClient, Role, RoundStatus } from '@prisma/client';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

// Mirrors src/modules/rounds/round-closing.scheduler.ts and round-reminder.scheduler.ts
// (this script compiles outside src/, so it cannot import them). Keep in step.
const ROUND_CLOSING_QUEUE = 'round-closing';
const ROUND_CLOSING_JOB = 'close-round';
const ROUND_REMINDER_QUEUE = 'round-reminder';
const ROUND_REMINDER_JOB = 'remind-round';
const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
const reminderJobId = (roundId: string): string => `reminder-${roundId}`;
const PENDING = ['delayed', 'waiting', 'active', 'prioritized'];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const at = (offsetMs: number): Date => new Date(now + offsetMs);

const DEMO_PREFIX = 'demo_';

interface ResidentSeed {
  key: string;
  society: 'GREEN001' | 'BLUE0002';
  phone: string;
  name: string;
  role?: Role;
}

const RESIDENTS: ResidentSeed[] = [
  // The primary demo resident: holds a round in every state.
  { key: 'asha', society: 'GREEN001', phone: '+919999900101', name: 'Asha Rao' },
  { key: 'vikram', society: 'GREEN001', phone: '+919999900102', name: 'Vikram Mehta' },
  { key: 'neha', society: 'GREEN001', phone: '+919999900103', name: 'Neha Kulkarni' },
  { key: 'rahul', society: 'GREEN001', phone: '+919999900104', name: 'Rahul Desai' },
  { key: 'priya', society: 'GREEN001', phone: '+919999900105', name: 'Priya Iyer' },
  { key: 'arjun', society: 'GREEN001', phone: '+919999900106', name: 'Arjun Nair' },
  { key: 'meera', society: 'GREEN001', phone: '+919999900107', name: 'Meera Joshi' },
  // No rounds at all — for the empty states.
  { key: 'kabir', society: 'GREEN001', phone: '+919999900108', name: 'Kabir Shah' },
  { key: 'farah', society: 'BLUE0002', phone: '+919999900201', name: 'Farah Khan' },
  { key: 'rohan', society: 'BLUE0002', phone: '+919999900202', name: 'Rohan Pillai' },
  { key: 'ananya', society: 'BLUE0002', phone: '+919999900203', name: 'Ananya Sen' },
  { key: 'dev', society: 'BLUE0002', phone: '+919999900204', name: 'Dev Malhotra' },
  // A second admin, so a browser pass need not burn the main admin's OTP quota (5/hour).
  { key: 'ops', society: 'BLUE0002', phone: '+919999900209', name: 'Ops Admin', role: 'SUPER_ADMIN' },
];

const VENDORS = [
  { id: 'demo_vendor_coolbreeze', name: 'CoolBreeze AC Services', phone: '+919888800001', category: 'Appliances', notes: 'Prefers weekday mornings. 2 technicians.' },
  { id: 'demo_vendor_shieldpro', name: 'ShieldPro Pest Control', phone: '+919888800002', category: 'Home Care', notes: 'Odourless gel treatment available.' },
  { id: 'demo_vendor_sparkle', name: 'SparkleHome Cleaning', phone: '+919888800003', category: 'Home Care', notes: null },
  { id: 'demo_vendor_colourcraft', name: 'ColourCraft Painters', phone: '+919888800004', category: 'Renovation', notes: 'Asian Paints certified.' },
  { id: 'demo_vendor_oldtown', name: 'OldTown Pest Co.', phone: '+919888800005', category: 'Home Care', notes: 'Deactivated after missed visits.', active: false },
];

interface ParticipantSeed {
  resident: string;
  units: number;
  paid?: boolean;
}

interface RatingSeed {
  resident: string;
  stars: number;
  comment?: string;
}

interface RoundSeed {
  id: string;
  society: 'GREEN001' | 'BLUE0002';
  service: string;
  status: RoundStatus;
  createdAt: Date;
  deadline: Date;
  tiers: { threshold: number; price: number }[];
  participants: ParticipantSeed[];
  vendor?: string;
  finalPrice?: number;
  assignedAt?: Date;
  deliveredAt?: Date;
  ratings?: RatingSeed[];
}

const ROUNDS: RoundSeed[] = [
  // ---- GREEN001 -------------------------------------------------------------
  {
    id: 'demo_g_pest_open',
    society: 'GREEN001',
    service: 'pest-control',
    status: 'OPEN',
    createdAt: at(-1 * DAY),
    deadline: at(4 * DAY),
    tiers: [
      { threshold: 5, price: 850 },
      { threshold: 10, price: 750 },
      { threshold: 20, price: 650 },
    ],
    // Below the first threshold: nothing unlocked yet.
    participants: [
      { resident: 'vikram', units: 1 },
      { resident: 'meera', units: 1 },
    ],
  },
  {
    id: 'demo_g_bath_open',
    society: 'GREEN001',
    service: 'bathroom-wash',
    status: 'OPEN',
    createdAt: at(-4 * DAY),
    // Closing soon, and one unit short of the second tier.
    deadline: at(3 * HOUR),
    tiers: [
      { threshold: 6, price: 550 },
      { threshold: 10, price: 480 },
    ],
    participants: [
      { resident: 'asha', units: 2 },
      { resident: 'priya', units: 3 },
      { resident: 'arjun', units: 2 },
      { resident: 'neha', units: 2 },
    ],
  },
  {
    id: 'demo_g_deep_met',
    society: 'GREEN001',
    service: 'deep-cleaning',
    status: 'CLOSED_MET',
    createdAt: at(-8 * DAY),
    deadline: at(-1 * DAY),
    tiers: [
      { threshold: 4, price: 2200 },
      { threshold: 8, price: 1950 },
    ],
    // Awaiting a vendor — the admin's "assign" action.
    participants: [
      { resident: 'vikram', units: 1 },
      { resident: 'neha', units: 1 },
      { resident: 'rahul', units: 1 },
      { resident: 'priya', units: 1 },
      { resident: 'meera', units: 1 },
    ],
  },
  {
    id: 'demo_g_paint_expired',
    society: 'GREEN001',
    service: 'painting',
    status: 'CLOSED_EXPIRED',
    createdAt: at(-10 * DAY),
    deadline: at(-3 * DAY),
    tiers: [
      { threshold: 6, price: 3000 },
      { threshold: 12, price: 2700 },
    ],
    participants: [
      { resident: 'asha', units: 2 },
      { resident: 'arjun', units: 1 },
    ],
  },
  {
    id: 'demo_g_pest_assigned',
    society: 'GREEN001',
    service: 'pest-control',
    status: 'ASSIGNED',
    createdAt: at(-13 * DAY),
    deadline: at(-6 * DAY),
    tiers: [
      { threshold: 5, price: 850 },
      { threshold: 10, price: 750 },
    ],
    vendor: 'demo_vendor_shieldpro',
    finalPrice: 800,
    assignedAt: at(-5 * DAY),
    // Half the money is in — the admin's payment toggles.
    participants: [
      { resident: 'asha', units: 1 },
      { resident: 'vikram', units: 1, paid: true },
      { resident: 'neha', units: 1, paid: true },
      { resident: 'rahul', units: 1 },
      { resident: 'priya', units: 1, paid: true },
      { resident: 'arjun', units: 1 },
    ],
  },
  {
    id: 'demo_g_ac_delivered',
    society: 'GREEN001',
    service: 'ac-servicing',
    status: 'DELIVERED',
    createdAt: at(-27 * DAY),
    deadline: at(-20 * DAY),
    tiers: [
      { threshold: 5, price: 900 },
      { threshold: 10, price: 700 },
    ],
    vendor: 'demo_vendor_coolbreeze',
    // Negotiated below the ₹700 tier — BUG-010 shows on this card.
    finalPrice: 680,
    assignedAt: at(-18 * DAY),
    deliveredAt: at(-2 * DAY),
    // No ratings: Asha can rate it from My Requests.
    participants: [
      { resident: 'asha', units: 3 },
      { resident: 'vikram', units: 2, paid: true },
      { resident: 'neha', units: 2, paid: true },
      { resident: 'rahul', units: 2, paid: true },
      { resident: 'meera', units: 2, paid: true },
    ],
  },
  {
    id: 'demo_g_deep_rated',
    society: 'GREEN001',
    service: 'deep-cleaning',
    status: 'RATED',
    createdAt: at(-47 * DAY),
    deadline: at(-40 * DAY),
    tiers: [
      { threshold: 4, price: 2200 },
      { threshold: 8, price: 1950 },
    ],
    vendor: 'demo_vendor_sparkle',
    finalPrice: 2100,
    assignedAt: at(-38 * DAY),
    deliveredAt: at(-30 * DAY),
    participants: [
      { resident: 'asha', units: 1, paid: true },
      { resident: 'priya', units: 1, paid: true },
      { resident: 'arjun', units: 1, paid: true },
      { resident: 'meera', units: 1, paid: true },
      { resident: 'vikram', units: 1, paid: true },
      { resident: 'neha', units: 1, paid: true },
      { resident: 'rahul', units: 1, paid: true },
    ],
    ratings: [
      { resident: 'asha', stars: 5, comment: 'Spotless kitchen, they even did the chimney filter.' },
      { resident: 'priya', stars: 4, comment: 'Good job, arrived an hour late.' },
      { resident: 'arjun', stars: 5 },
      { resident: 'meera', stars: 3, comment: 'Missed the balcony windows.' },
    ],
  },
  {
    id: 'demo_g_bath_cancelled',
    society: 'GREEN001',
    service: 'bathroom-wash',
    status: 'CANCELLED',
    createdAt: at(-17 * DAY),
    deadline: at(-10 * DAY),
    tiers: [{ threshold: 6, price: 550 }],
    participants: [
      { resident: 'asha', units: 1 },
      { resident: 'rahul', units: 1 },
    ],
  },
  // ---- BLUE0002 -------------------------------------------------------------
  {
    id: 'demo_b_paint_open',
    society: 'BLUE0002',
    service: 'painting',
    status: 'OPEN',
    createdAt: at(-2 * DAY),
    deadline: at(6 * DAY),
    tiers: [
      { threshold: 6, price: 3100 },
      { threshold: 12, price: 2800 },
    ],
    participants: [
      { resident: 'farah', units: 3 },
      { resident: 'rohan', units: 2 },
    ],
  },
  {
    id: 'demo_b_ac_open',
    society: 'BLUE0002',
    service: 'ac-servicing',
    status: 'OPEN',
    createdAt: at(-3 * DAY),
    deadline: at(2 * DAY),
    tiers: [
      { threshold: 5, price: 920 },
      { threshold: 10, price: 720 },
    ],
    participants: [
      { resident: 'ananya', units: 1 },
      { resident: 'dev', units: 2 },
      { resident: 'farah', units: 1 },
    ],
  },
  {
    id: 'demo_b_bath_rated',
    society: 'BLUE0002',
    service: 'bathroom-wash',
    status: 'RATED',
    createdAt: at(-32 * DAY),
    deadline: at(-25 * DAY),
    tiers: [
      { threshold: 6, price: 550 },
      { threshold: 10, price: 480 },
    ],
    vendor: 'demo_vendor_sparkle',
    finalPrice: 520,
    assignedAt: at(-23 * DAY),
    deliveredAt: at(-15 * DAY),
    participants: [
      { resident: 'farah', units: 2, paid: true },
      { resident: 'rohan', units: 2, paid: true },
      { resident: 'ananya', units: 1, paid: true },
      { resident: 'dev', units: 1 },
    ],
    ratings: [
      { resident: 'farah', stars: 4, comment: 'Tiles look new again.' },
      { resident: 'rohan', stars: 5 },
    ],
  },
];

/** Participants added to the base seed's OPEN AC round in GREEN001 (6 units: tier 5 met, 10 next). */
const BASE_AC_ROUND_PARTICIPANTS: ParticipantSeed[] = [
  { resident: 'asha', units: 2 },
  { resident: 'vikram', units: 1 },
  { resident: 'neha', units: 2 },
  { resident: 'rahul', units: 1 },
];

/**
 * The lifecycle notifications a round in `status` has already sent to each participant.
 * The "closing soon" reminder fires REMINDER_LEAD_MS before the deadline — so it has
 * already gone out iff that instant is past and fell inside the round's window.
 */
function sentNotifications(r: RoundSeed): { type: NotificationType; sentAt: Date }[] {
  const closed = r.deadline;
  const remindAt = new Date(r.deadline.getTime() - REMINDER_LEAD_MS);
  const reminded = remindAt.getTime() <= now && remindAt > r.createdAt;
  const reminder: { type: NotificationType; sentAt: Date }[] = reminded
    ? [{ type: 'ROUND_CLOSING_SOON', sentAt: remindAt }]
    : [];
  switch (r.status) {
    case 'OPEN':
      return reminder;
    case 'CLOSED_MET':
      return [...reminder, { type: 'ROUND_CLOSED_MET', sentAt: closed }];
    case 'CLOSED_EXPIRED':
      return [...reminder, { type: 'ROUND_CLOSED_EXPIRED', sentAt: closed }];
    case 'CANCELLED':
      return [...reminder, { type: 'ROUND_CANCELLED', sentAt: closed }];
    case 'ASSIGNED':
      return [
        ...reminder,
        { type: 'ROUND_CLOSED_MET', sentAt: closed },
        { type: 'ROUND_ASSIGNED', sentAt: r.assignedAt! },
      ];
    case 'DELIVERED':
    case 'RATED':
      return [
        ...reminder,
        { type: 'ROUND_CLOSED_MET', sentAt: closed },
        { type: 'ROUND_ASSIGNED', sentAt: r.assignedAt! },
        { type: 'ROUND_DELIVERED', sentAt: r.deliveredAt! },
      ];
  }
}

/**
 * Give an OPEN round a close job at its deadline and a reminder job at deadline − lead,
 * with the same ids and options the app's schedulers use. With `replace`, any existing
 * job is removed first (a demo round's old job carries the previous seed's deadline);
 * without it, a pending job is kept — the schedulers' own rule, for rounds we don't own.
 */
async function scheduleJobs(
  queues: { closing: Queue; reminder: Queue },
  roundId: string,
  deadline: Date,
  replace: boolean,
): Promise<void> {
  const jobs = [
    { queue: queues.closing, name: ROUND_CLOSING_JOB, id: roundId, attempts: 6, delay: deadline.getTime() - Date.now() },
    { queue: queues.reminder, name: ROUND_REMINDER_JOB, id: reminderJobId(roundId), attempts: 3, delay: deadline.getTime() - REMINDER_LEAD_MS - Date.now() },
  ];
  for (const job of jobs) {
    const existing = await job.queue.getJob(job.id);
    if (existing) {
      if (!replace && PENDING.includes(await existing.getState())) continue;
      try {
        await existing.remove();
      } catch {
        // Locked mid-processing by a running worker. Leave it rather than abort the
        // seed half-way; restarting the backend lets the reconciler re-ensure it.
        console.warn(`  WARN could not replace job ${job.id} (in progress) — restart the backend`);
        continue;
      }
    }
    // Close jobs clamp to 0 (a past deadline closes now); a reminder whose instant has
    // passed is not sent at all — RoundReminderScheduler.delayFor's rule.
    if (job.name === ROUND_REMINDER_JOB && job.delay <= 0) continue;
    await job.queue.add(
      job.name,
      { roundId },
      {
        jobId: job.id,
        delay: Math.max(0, job.delay),
        attempts: job.attempts,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 60 * 60 },
      },
    );
  }
}

/** Remove a deleted demo round's jobs (best effort: a job mid-processing cannot be removed). */
async function removeJobs(queues: { closing: Queue; reminder: Queue }, roundId: string): Promise<void> {
  for (const [queue, id] of [[queues.closing, roundId], [queues.reminder, reminderJobId(roundId)]] as const) {
    const job = await queue.getJob(id);
    if (job) await job.remove().catch(() => undefined);
  }
}

function assertLocalDatabase(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo refuses to run with NODE_ENV=production.');
  }
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // Unparseable: treated as not-local.
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host) && process.env.ALLOW_DEMO_SEED !== '1') {
    throw new Error(
      `seed-demo only runs against a local database (DATABASE_URL host is "${host || 'unset'}"). ` +
        'Set ALLOW_DEMO_SEED=1 to override — it promotes +919999900209 to SUPER_ADMIN.',
    );
  }
}

const NOTIFICATION_BODY: Record<NotificationType, (service: string) => string> = {
  ROUND_JOINED: (s) => `You joined the ${s} group-buy.`,
  ROUND_CLOSING_SOON: (s) => `The ${s} group-buy closes soon.`,
  ROUND_CLOSED_MET: (s) => `The ${s} group-buy reached its target. A vendor will be assigned shortly.`,
  ROUND_CLOSED_EXPIRED: (s) => `The ${s} group-buy closed without reaching its target. You will not be charged.`,
  ROUND_ASSIGNED: (s) => `A vendor has been assigned for your ${s} booking.`,
  ROUND_DELIVERED: (s) => `Your ${s} service is marked delivered. Tell us how it went.`,
  ROUND_CANCELLED: (s) => `The ${s} group-buy was cancelled. You will not be charged.`,
};

function checkRound(r: RoundSeed, unitsCount: number): void {
  const lowest = Math.min(...r.tiers.map((t) => t.threshold));
  const met = unitsCount >= lowest;
  if (r.status === 'CLOSED_EXPIRED' && met) throw new Error(`${r.id}: expired but ${unitsCount} >= ${lowest}`);
  if (['CLOSED_MET', 'ASSIGNED', 'DELIVERED', 'RATED'].includes(r.status) && !met) {
    throw new Error(`${r.id}: ${r.status} but ${unitsCount} < ${lowest}`);
  }
  const assigned = ['ASSIGNED', 'DELIVERED', 'RATED'].includes(r.status);
  if (assigned !== Boolean(r.vendor && r.finalPrice && r.assignedAt)) throw new Error(`${r.id}: vendor fields vs ${r.status}`);
  if (['DELIVERED', 'RATED'].includes(r.status) !== Boolean(r.deliveredAt)) throw new Error(`${r.id}: deliveredAt vs ${r.status}`);
  if ((r.status === 'RATED') !== Boolean(r.ratings?.length)) throw new Error(`${r.id}: ratings vs ${r.status}`);
  if (!assigned && r.participants.some((p) => p.paid)) throw new Error(`${r.id}: payment before a final price`);
  if (r.status === 'OPEN' && r.deadline.getTime() <= now) throw new Error(`${r.id}: OPEN with a past deadline`);
}

async function main(): Promise<void> {
  assertLocalDatabase();

  const connection = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  };
  const queues = {
    closing: new Queue(ROUND_CLOSING_QUEUE, { connection }),
    reminder: new Queue(ROUND_REMINDER_QUEUE, { connection }),
  };
  try {
    await seed(queues);
  } finally {
    await Promise.all([queues.closing.close(), queues.reminder.close()]);
  }
}

async function seed(queues: { closing: Queue; reminder: Queue }): Promise<void> {
  const societies = await prisma.society.findMany({ where: { inviteCode: { in: ['GREEN001', 'BLUE0002'] } } });
  const societyId = new Map(societies.map((s) => [s.inviteCode, s.id]));
  if (societyId.size !== 2) throw new Error('Base seed missing — run `pnpm --filter backend seed` first.');

  const services = await prisma.service.findMany();
  const serviceBySlug = new Map(services.map((s) => [s.slug, s]));

  // Residents (upsert; never deleted).
  const residentId = new Map<string, string>();
  for (const r of RESIDENTS) {
    const sid = societyId.get(r.society)!;
    const row = await prisma.resident.upsert({
      where: { societyId_phone: { societyId: sid, phone: r.phone } },
      create: { societyId: sid, phone: r.phone, name: r.name, role: r.role ?? 'RESIDENT', verifiedAt: at(-60 * DAY) },
      update: { name: r.name, role: r.role ?? 'RESIDENT' },
    });
    residentId.set(r.key, row.id);
  }

  for (const v of VENDORS) {
    const data = { name: v.name, phone: v.phone, category: v.category, notes: v.notes, active: v.active ?? true };
    await prisma.vendor.upsert({ where: { id: v.id }, create: { id: v.id, ...data }, update: data });
  }

  // Reset: drop every demo round (cascades participants, ratings, notifications) and
  // its queued jobs — including demo ids no longer in ROUNDS.
  const stale = await prisma.round.findMany({ where: { id: { startsWith: DEMO_PREFIX } }, select: { id: true } });
  for (const id of new Set([...stale.map((r) => r.id), ...ROUNDS.map((r) => r.id)])) {
    await removeJobs(queues, id);
  }
  const { count: removed } = await prisma.round.deleteMany({ where: { id: { startsWith: DEMO_PREFIX } } });

  const created: string[] = [];
  const skipped: string[] = [];
  for (const r of ROUNDS) {
    const sid = societyId.get(r.society)!;
    const service = serviceBySlug.get(r.service);
    if (!service) throw new Error(`${r.id}: unknown service ${r.service}`);
    const unitsCount = r.participants.reduce((sum, p) => sum + p.units, 0);
    checkRound(r, unitsCount);

    if (r.status === 'OPEN') {
      // The partial unique index allows one OPEN round per (society, service).
      const holder = await prisma.round.findFirst({ where: { societyId: sid, serviceId: service.id, status: 'OPEN' } });
      if (holder) {
        skipped.push(`${r.id} (an OPEN ${r.service} round already exists in ${r.society}: ${holder.id})`);
        continue;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.round.create({
        data: {
          id: r.id,
          societyId: sid,
          serviceId: service.id,
          status: r.status,
          unitsCount,
          deadline: r.deadline,
          createdAt: r.createdAt,
          vendorId: r.vendor ?? null,
          finalPrice: r.finalPrice ?? null,
          assignedAt: r.assignedAt ?? null,
          deliveredAt: r.deliveredAt ?? null,
          tiers: { create: r.tiers },
        },
      });
      for (const p of r.participants) {
        const rid = residentId.get(p.resident)!;
        const participant = await tx.roundParticipant.create({
          data: {
            id: `${r.id}_p_${p.resident}`,
            roundId: r.id,
            residentId: rid,
            units: p.units,
            createdAt: r.createdAt,
            paymentCollectedAt: p.paid ? (r.deliveredAt ?? r.assignedAt ?? null) : null,
          },
        });
        await tx.notification.create({
          data: {
            residentId: rid,
            roundId: r.id,
            type: 'ROUND_JOINED',
            status: 'SENT',
            body: NOTIFICATION_BODY.ROUND_JOINED(service.name),
            dedupeKey: `ROUND_JOINED:${participant.id}`,
            attempts: 1,
            sentAt: r.createdAt,
            createdAt: r.createdAt,
          },
        });
        for (const n of sentNotifications(r)) {
          await tx.notification.create({
            data: {
              residentId: rid,
              roundId: r.id,
              type: n.type,
              status: 'SENT',
              body: NOTIFICATION_BODY[n.type](service.name),
              dedupeKey: `${n.type}:${r.id}:${rid}`,
              attempts: 1,
              sentAt: n.sentAt,
              createdAt: n.sentAt,
            },
          });
        }
      }
      for (const rating of r.ratings ?? []) {
        if (!r.participants.some((p) => p.resident === rating.resident)) {
          throw new Error(`${r.id}: ${rating.resident} rated without participating`);
        }
        await tx.rating.create({
          data: {
            roundId: r.id,
            residentId: residentId.get(rating.resident)!,
            stars: rating.stars,
            comment: rating.comment ?? null,
            createdAt: at(-((now - r.deliveredAt!.getTime()) / 2)),
          },
        });
      }
    });
    if (r.status === 'OPEN') {
      await scheduleJobs(queues, r.id, r.deadline, true);
    }
    created.push(`${r.society} ${r.status.padEnd(14)} ${r.service.padEnd(14)} ${unitsCount} units  (${r.id})`);
  }

  // Give the base seed's OPEN AC round in GREEN001 some participants. Upserted, then
  // unitsCount recomputed from ALL its participants — anyone who joined via the app counts.
  const ac = serviceBySlug.get('ac-servicing')!;
  const baseAc = await prisma.round.findFirst({
    where: { societyId: societyId.get('GREEN001')!, serviceId: ac.id, status: 'OPEN', id: { not: { startsWith: DEMO_PREFIX } } },
  });
  if (baseAc) {
    await prisma.$transaction(async (tx) => {
      for (const p of BASE_AC_ROUND_PARTICIPANTS) {
        const rid = residentId.get(p.resident)!;
        const participant = await tx.roundParticipant.upsert({
          where: { roundId_residentId: { roundId: baseAc.id, residentId: rid } },
          create: { roundId: baseAc.id, residentId: rid, units: p.units },
          update: { units: p.units },
        });
        const dedupeKey = `ROUND_JOINED:${participant.id}`;
        await tx.notification.upsert({
          where: { dedupeKey },
          create: {
            residentId: rid,
            roundId: baseAc.id,
            type: 'ROUND_JOINED',
            status: 'SENT',
            body: NOTIFICATION_BODY.ROUND_JOINED(ac.name),
            dedupeKey,
            attempts: 1,
            sentAt: participant.createdAt,
          },
          update: {},
        });
      }
      const { _sum } = await tx.roundParticipant.aggregate({ where: { roundId: baseAc.id }, _sum: { units: true } });
      await tx.round.update({ where: { id: baseAc.id }, data: { unitsCount: _sum.units ?? 0 } });
    });
    // Not our round, so a pending job is kept; this only fills in a missing one.
    await scheduleJobs(queues, baseAc.id, baseAc.deadline, false);
  }

  console.log('Demo seed complete:');
  console.log(`  Residents: ${RESIDENTS.length} (demo resident: Asha Rao +919999900101 in GREEN001; empty-state: Kabir Shah +919999900108)`);
  console.log('  Admins: +919999900001 (GREEN001), +919999900209 (BLUE0002)');
  console.log(`  Vendors: ${VENDORS.length} (1 deactivated)`);
  console.log(`  Demo rounds removed and recreated: ${removed} -> ${created.length}`);
  for (const line of created) console.log(`    ${line}`);
  for (const line of skipped) console.log(`  SKIPPED ${line}`);
  console.log(`  Base AC round in GREEN001: ${baseAc ? `${BASE_AC_ROUND_PARTICIPANTS.length} participants added` : 'not found (run the base seed)'}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
