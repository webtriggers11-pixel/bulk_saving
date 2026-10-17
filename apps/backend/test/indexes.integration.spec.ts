import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { CapturingChannel, createTestApp } from './helpers/test-app';

/**
 * CHORE-015: `POST /auth/admin/otp/request` is unauthenticated and looks a resident up by
 * `phone` alone. The only index on that column was `@@unique([societyId, phone])`, whose
 * LEADING column is societyId — so every request was a sequential scan of Resident.
 *
 * Asserts the plan uses `Resident_phone_idx` by name. Sequential scans are disabled for
 * the one statement because on a small table the planner rightly prefers a scan anyway;
 * the question is whether the index EXISTS and fits the query, not whether it wins today.
 */
describe('Resident phone lookups have an index (integration, needs DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('the admin-door lookup (phone + role) can use Resident_phone_idx', async () => {
    const plan = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
      return tx.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
        `EXPLAIN SELECT * FROM "Resident" WHERE phone = '+910000000000' AND role = 'SUPER_ADMIN'`,
      );
    });
    expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toMatch(/Resident_phone_idx/);
  });
});
