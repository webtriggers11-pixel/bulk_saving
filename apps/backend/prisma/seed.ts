/**
 * FEAT-001 seed — the only way societies + the first super-admin exist in v1
 * (no self-serve society signup). Idempotent: safe to run repeatedly.
 *
 * Run:  pnpm --filter backend seed
 * (compiles this file with the project's tsc to prisma/dist, then runs the JS —
 *  so it works on any supported Node version, not only Node 22+ native TS).
 * Needs Postgres up (`docker compose up -d`) and DATABASE_URL set (apps/backend/.env).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOCIETIES = [
  { name: 'Green Meadows', city: 'Pune', inviteCode: 'GREEN001' },
  { name: 'Blue Waters', city: 'Mumbai', inviteCode: 'BLUE0002' },
];

const SUPER_ADMIN_PHONE = '+919999900001';

/**
 * FEAT-002 master services (ADR-0009). `indicativePrice` (integer rupees) is the
 * per-society display price seeded onto each offering; it is NOT the round price.
 */
const SERVICES = [
  {
    name: 'AC Servicing',
    slug: 'ac-servicing',
    description: 'Split & window AC cleaning, gas check and general servicing.',
    category: 'Appliances',
    indicativePrice: 499,
  },
  {
    name: 'Pest Control',
    slug: 'pest-control',
    description: 'General cockroach, ant and mosquito treatment for your flat.',
    category: 'Home Care',
    indicativePrice: 899,
  },
  {
    name: 'Deep Cleaning',
    slug: 'deep-cleaning',
    description: 'Full-home deep clean — kitchen, bathrooms, floors and windows.',
    category: 'Home Care',
    indicativePrice: 2499,
  },
  {
    name: 'Bathroom Wash',
    slug: 'bathroom-wash',
    description: 'Intensive descaling and sanitisation of bathrooms.',
    category: 'Home Care',
    indicativePrice: 599,
  },
  {
    name: 'Painting',
    slug: 'painting',
    description: 'Interior wall painting with premium emulsion.',
    category: 'Renovation',
    indicativePrice: 15000,
  },
];

async function main(): Promise<void> {
  for (const s of SOCIETIES) {
    await prisma.society.upsert({
      where: { inviteCode: s.inviteCode },
      create: s,
      update: { name: s.name, city: s.city },
    });
  }

  const green = await prisma.society.findUniqueOrThrow({ where: { inviteCode: 'GREEN001' } });
  await prisma.resident.upsert({
    where: { societyId_phone: { societyId: green.id, phone: SUPER_ADMIN_PHONE } },
    create: {
      societyId: green.id,
      phone: SUPER_ADMIN_PHONE,
      name: 'Platform Admin',
      role: 'SUPER_ADMIN',
      verifiedAt: new Date(),
    },
    update: { role: 'SUPER_ADMIN', verifiedAt: new Date() },
  });

  // Master services (idempotent upsert by unique slug).
  for (const svc of SERVICES) {
    await prisma.service.upsert({
      where: { slug: svc.slug },
      create: {
        name: svc.name,
        slug: svc.slug,
        description: svc.description,
        category: svc.category,
        active: true,
      },
      update: { name: svc.name, description: svc.description, category: svc.category, active: true },
    });
  }

  // Enable every master service for BOTH seeded societies, zero-friction (ADR-0009).
  const societies = await prisma.society.findMany({
    where: { inviteCode: { in: SOCIETIES.map((s) => s.inviteCode) } },
  });
  let offeringCount = 0;
  for (const society of societies) {
    for (const svc of SERVICES) {
      const service = await prisma.service.findUniqueOrThrow({ where: { slug: svc.slug } });
      await prisma.serviceOffering.upsert({
        where: { societyId_serviceId: { societyId: society.id, serviceId: service.id } },
        create: {
          societyId: society.id,
          serviceId: service.id,
          enabled: true,
          indicativePrice: svc.indicativePrice,
        },
        update: { enabled: true, indicativePrice: svc.indicativePrice },
      });
      offeringCount += 1;
    }
  }

  // FEAT-003 (ADR-0010): open ONE demo group-buy round — AC Servicing in
  // GREEN001, tiers 5→₹900 / 10→₹700, deadline ~7 days out. Idempotent: skip if
  // an OPEN round for the pair already exists (also enforced by a partial unique
  // index), so re-running the seed never creates a duplicate open round.
  const acService = await prisma.service.findUniqueOrThrow({ where: { slug: 'ac-servicing' } });
  const existingOpenRound = await prisma.round.findFirst({
    where: { societyId: green.id, serviceId: acService.id, status: 'OPEN' },
  });
  if (!existingOpenRound) {
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.round.create({
      data: {
        societyId: green.id,
        serviceId: acService.id,
        deadline,
        tiers: {
          create: [
            { threshold: 5, price: 900 },
            { threshold: 10, price: 700 },
          ],
        },
      },
    });
  }

  console.log('Seed complete:');
  for (const s of SOCIETIES) {
    console.log(`  Society: ${s.inviteCode} — ${s.name} (${s.city})`);
  }
  console.log(`  Super-admin resident: ${SUPER_ADMIN_PHONE} in Green Meadows (GREEN001)`);
  console.log(`  Master services: ${SERVICES.length} (${SERVICES.map((s) => s.slug).join(', ')})`);
  console.log(`  Service offerings created/updated: ${offeringCount} (enabled for both societies)`);
  console.log('  Demo round: AC Servicing in GREEN001 (OPEN, tiers 5->900 / 10->700, ~7d deadline)');
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
