import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Round, Society } from '@prisma/client';
import type { AdminResidentPledgeDto, AdminRoundParticipantDto, AdminSocietyDemand, AdminSocietyDetailDto, Page } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * FEAT-044 (ADR-0035): the lists FEAT-025 didn't reach are pages too: societies (with
 * search), a user's pledges, a round's participants, and demand by society. Same contract:
 * exactly `limit` rows, a cursor that continues without a gap or repeat, `nextCursor: null`
 * at the end, `total` = the filtered count, bad input → 400, a gone cursor → an empty page.
 */
describe('Pagination of admin details (FEAT-044, integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let residentToken: string;
  let home: Society;
  let busy: Resident;
  let bigRound: Round;
  let adminId = '';
  const societies: Society[] = [];
  const serviceIds: string[] = [];
  const tag = `pd${randomInviteCode().toLowerCase()}`;

  const get = (path: string, token = adminToken) => request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

  /** Walk every page, asserting the contract on the way. */
  async function walk<T>(path: string, limit: number, idOf: (item: T) => string): Promise<{ items: T[]; pages: number; total: number }> {
    const items: T[] = [];
    let cursor: string | null = null;
    let pages = 0;
    let total = -1;
    for (;;) {
      const url = `${path}${path.includes('?') ? '&' : '?'}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = (await get(url).expect(200)).body.data as Page<T>;
      pages += 1;
      total = page.total;
      expect(page.items.length).toBeLessThanOrEqual(limit);
      items.push(...page.items);
      if (page.nextCursor === null) break;
      expect(page.items.length).toBe(limit);
      cursor = page.nextCursor;
      if (pages > 50) throw new Error('runaway pagination');
    }
    expect(new Set(items.map(idOf)).size).toBe(items.length);
    return { items, pages, total };
  }

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
    // Five societies whose names sort inside this suite: "<tag> A" … "<tag> E".
    for (const letter of ['C', 'A', 'E', 'B', 'D']) {
      societies.push(await prisma.society.create({ data: { name: `${tag} ${letter}`, city: letter === 'E' ? 'Nagpur' : 'Pune', inviteCode: randomInviteCode() } }));
    }
    home = societies[1]; // "<tag> A"
    const admin = await prisma.resident.create({ data: { societyId: null, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() } });
    busy = await prisma.resident.create({ data: { societyId: home.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() } });
    adminId = admin.id;
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentToken = (await auth.issueTokens(busy)).accessToken;
    const neighbours: Resident[] = [];
    for (let n = 0; n < 4; n += 1) {
      neighbours.push(await prisma.resident.create({ data: { societyId: home.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() } }));
    }
    // `busy` pledges in 7 rounds; the first round also has the 4 neighbours (5 participants).
    for (let n = 0; n < 7; n += 1) {
      const service = await prisma.service.create({ data: { name: `${tag} Svc ${n}`, slug: `${tag}-${n}`, description: 'x', category: 'Home Care' } });
      serviceIds.push(service.id);
      const round = await prisma.round.create({
        data: {
          societyId: home.id,
          serviceId: service.id,
          deadline: new Date(Date.now() + 86_400_000),
          unitsCount: n === 0 ? 5 : 1,
          tiers: { create: [{ threshold: 10, price: 500 }] },
          participants: { create: [{ residentId: busy.id, units: 1 }, ...(n === 0 ? neighbours.map((r) => ({ residentId: r.id, units: 1 })) : [])] },
        },
      });
      if (n === 0) bigRound = round;
    }
    // One of the pledges is in a cancelled round: counted in pledgeCount, not activePledgeCount.
    await prisma.round.updateMany({ where: { serviceId: serviceIds[6] }, data: { status: 'CANCELLED' } });
  });

  afterAll(async () => {
    await prisma.society.deleteMany({ where: { id: { in: societies.map((s) => s.id) } } });
    // A society-less admin isn't swept by the society cascade (the FEAT-038 leak lesson).
    await prisma.resident.deleteMany({ where: { id: adminId } });
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await app.close();
  });

  it('GET /admin/societies pages by name, with search, and every page is SUPER_ADMIN only', async () => {
    const all = await walk<AdminSocietyDetailDto>(`/admin/societies?q=${tag}`, 2, (s) => s.id);
    expect(all.total).toBe(5);
    expect(all.pages).toBe(3);
    expect(all.items.map((s) => s.name)).toEqual(['A', 'B', 'C', 'D', 'E'].map((l) => `${tag} ${l}`));
    expect(all.items[0]).toMatchObject({ residentCount: 5, roundCount: 7 });

    // `q` matches the city too; `status` filters active.
    const byCity = (await get('/admin/societies?q=Nagpur&limit=50').expect(200)).body.data as Page<AdminSocietyDetailDto>;
    expect(byCity.items.some((s) => s.name === `${tag} E`)).toBe(true);
    await prisma.society.update({ where: { id: societies[0].id }, data: { active: false } });
    const inactive = (await get(`/admin/societies?q=${tag}&status=inactive`).expect(200)).body.data as Page<AdminSocietyDetailDto>;
    expect(inactive.items.map((s) => s.id)).toEqual([societies[0].id]);

    await get('/admin/societies', residentToken).expect(403);
    for (const bad of ['limit=0', 'limit=51', 'status=gone', `q=${'x'.repeat(200)}`]) {
      await get(`/admin/societies?${bad}`).expect(400);
    }
    const gone = (await get('/admin/societies?limit=3&cursor=no-such-id').expect(200)).body.data as Page<AdminSocietyDetailDto>;
    expect(gone).toEqual({ items: [], nextCursor: null, total: expect.any(Number) });
  });

  it("GET /admin/residents/:id/pledges pages a user's pledges newest first; the detail carries counts", async () => {
    const detail = (await get(`/admin/residents/${busy.id}`).expect(200)).body.data as { pledgeCount: number; activePledgeCount: number };
    expect(detail).toMatchObject({ pledgeCount: 7, activePledgeCount: 6 });
    expect('pledges' in detail).toBe(false);

    const all = await walk<AdminResidentPledgeDto>(`/admin/residents/${busy.id}/pledges`, 3, (p) => p.roundId);
    expect(all.total).toBe(7);
    expect(all.pages).toBe(3);
    const joined = all.items.map((p) => Date.parse(p.joinedAt));
    expect([...joined].sort((a, b) => b - a)).toEqual(joined);
    await get(`/admin/residents/${busy.id}/pledges`, residentToken).expect(403);
    await get('/admin/residents/nope/pledges').expect(404);
    await get(`/admin/residents/${busy.id}/pledges?limit=abc`).expect(400);
  });

  it("GET /admin/rounds/:id/participants pages a round's participants in join order; the detail keeps the totals", async () => {
    const detail = (await get(`/admin/rounds/${bigRound.id}`).expect(200)).body.data as { participantsCount: number; payments: { participantsCount: number } };
    expect(detail.participantsCount).toBe(5);
    expect(detail.payments.participantsCount).toBe(5);
    expect('participants' in detail).toBe(false);

    const all = await walk<AdminRoundParticipantDto>(`/admin/rounds/${bigRound.id}/participants`, 2, (p) => p.id);
    expect(all.total).toBe(5);
    expect(all.pages).toBe(3);
    expect(all.items[0].resident.id).toBe(busy.id);
    await get(`/admin/rounds/${bigRound.id}/participants`, residentToken).expect(403);
    await get('/admin/rounds/nope/participants').expect(404);
  });

  it('GET /admin/dashboard/demand pages every society by name with its open demand', async () => {
    const all = await walk<AdminSocietyDemand>('/admin/dashboard/demand', 50, (d) => d.society.id);
    expect(all.total).toBe(await prisma.society.count());
    const mine = all.items.filter((d) => d.society.name.startsWith(tag));
    expect(mine.map((d) => d.society.name)).toEqual(['A', 'B', 'C', 'D', 'E'].map((l) => `${tag} ${l}`));
    // 6 OPEN rounds in "A" (one of the 7 was cancelled): 5 + 1×5 units, 5 distinct residents.
    expect(mine[0]).toMatchObject({ openRounds: 6, unitsPledged: 10, residentsJoined: 5 });
    expect(mine[1]).toMatchObject({ openRounds: 0, unitsPledged: 0, residentsJoined: 0 });
    await get('/admin/dashboard/demand', residentToken).expect(403);
  });
});
