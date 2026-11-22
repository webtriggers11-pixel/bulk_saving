import type { PrismaClient } from '@prisma/client';

/**
 * Upsert a platform admin: SUPER_ADMIN with no society (FEAT-036, ADR-0046). A database
 * seeded before FEAT-036 holds the same phone as an admin INSIDE a society; that row is
 * adopted (moved out of its society) rather than duplicated, so its sessions stay valid.
 */
export async function upsertPlatformAdmin(prisma: PrismaClient, phone: string, name: string): Promise<void> {
  const standalone = await prisma.resident.findFirst({ where: { phone, societyId: null } });
  if (standalone) {
    await prisma.resident.update({ where: { id: standalone.id }, data: { role: 'SUPER_ADMIN', name, active: true } });
    return;
  }
  const legacy = await prisma.resident.findFirst({
    where: { phone, role: 'SUPER_ADMIN', roundParticipations: { none: {} } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (legacy) {
    // Its asks and push subscriptions carry the old society; a platform admin has none (V2 P3-5).
    await prisma.$transaction([
      prisma.serviceAsk.deleteMany({ where: { residentId: legacy.id } }),
      prisma.pushSubscription.deleteMany({ where: { residentId: legacy.id } }),
      prisma.resident.update({ where: { id: legacy.id }, data: { societyId: null, name, active: true } }),
    ]);
    console.log(`  Adopted ${phone} as a platform admin (moved out of its society).`);
    return;
  }
  await prisma.resident.create({
    data: { phone, name, role: 'SUPER_ADMIN', societyId: null, verifiedAt: new Date() },
  });
}
