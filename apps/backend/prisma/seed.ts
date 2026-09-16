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

  console.log('Seed complete:');
  for (const s of SOCIETIES) {
    console.log(`  Society: ${s.inviteCode} — ${s.name} (${s.city})`);
  }
  console.log(`  Super-admin resident: ${SUPER_ADMIN_PHONE} in Green Meadows (GREEN001)`);
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
