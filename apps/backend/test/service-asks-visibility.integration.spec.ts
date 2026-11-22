import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Service, Society } from '@prisma/client';
import type { AdminServiceAsk } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * BUG-029: a new request must reach the admin. The asks list is newest-first by the latest
 * ask (a brand-new single ask used to sort LAST among single asks), each row says when the
 * latest ask came in, and the overview counts the waiting requests for the sidebar badge.
 */
describe('Service asks reach the admin (BUG-029)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let oldSociety: Society;
  let newSociety: Society;
  let service: Service;
  let adminToken: string;
  let adminId: string;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
    oldSociety = await prisma.society.create({ data: { name: `Old Asks ${suffix}`, city: 'Pune', inviteCode: randomInviteCode() } });
    newSociety = await prisma.society.create({ data: { name: `New Asks ${suffix}`, city: 'Pune', inviteCode: randomInviteCode() } });
    service = await prisma.service.create({
      data: { name: 'RO Purifier', slug: `ro-${suffix}`, description: 'x', category: 'Appliances', active: true },
    });
    await prisma.serviceOffering.createMany({
      data: [
        { societyId: oldSociety.id, serviceId: service.id, enabled: true },
        { societyId: newSociety.id, serviceId: service.id, enabled: true },
      ],
    });
    const mk = (societyId: string) => prisma.resident.create({ data: { societyId, phone: randomPhone(), role: 'RESIDENT' } });
    // Three residents asked two days ago in the old society; one resident asks now in the new one.
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    const olds: Resident[] = [await mk(oldSociety.id), await mk(oldSociety.id), await mk(oldSociety.id)];
    for (const r of olds) {
      await prisma.serviceAsk.create({ data: { residentId: r.id, societyId: oldSociety.id, serviceId: service.id, createdAt: twoDaysAgo } });
    }
    const asker = await mk(newSociety.id);
    const askerToken = (await auth.issueTokens(asker)).accessToken;
    await http().post(`/catalog/${service.id}/ask`).set('Authorization', `Bearer ${askerToken}`).expect(200);
    const admin = await prisma.resident.create({ data: { societyId: null, phone: randomPhone(), role: 'SUPER_ADMIN' } });
    adminId = admin.id;
    adminToken = (await auth.issueTokens(admin)).accessToken;
  });

  afterAll(async () => {
    await prisma.resident.deleteMany({ where: { id: adminId } });
    await prisma.society.deleteMany({ where: { id: { in: [oldSociety.id, newSociety.id] } } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await app.close();
  });

  it('lists the newest request first and says when it came in', async () => {
    const res = await http().get('/admin/dashboard').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const asks = res.body.data.asks as AdminServiceAsk[];
    const fresh = asks.findIndex((a) => a.society.id === newSociety.id && a.service.id === service.id);
    const stale = asks.findIndex((a) => a.society.id === oldSociety.id && a.service.id === service.id);
    expect(fresh).toBeGreaterThanOrEqual(0);
    expect(stale).toBeGreaterThanOrEqual(0);
    // A single brand-new ask beats three two-day-old ones: this is a to-do list, newest first.
    expect(fresh).toBeLessThan(stale);
    expect(Date.now() - new Date(asks[fresh].latest).getTime()).toBeLessThan(60_000);
    expect(asks[stale].askCount).toBe(3);
    // FEAT-037: "Most asked" puts the three-ask pair above the one-ask pair, whatever their age.
    const most = res.body.data.asksMostAsked as AdminServiceAsk[];
    const mStale = most.findIndex((a) => a.society.id === oldSociety.id && a.service.id === service.id);
    const mFresh = most.findIndex((a) => a.society.id === newSociety.id && a.service.id === service.id);
    expect(mStale).toBeGreaterThanOrEqual(0);
    expect(mFresh === -1 || mStale < mFresh).toBe(true);
    for (let i = 1; i < most.length; i += 1) expect(most[i - 1].askCount).toBeGreaterThanOrEqual(most[i].askCount);
    expect(new Date(asks[stale].latest).getTime()).toBeLessThan(Date.now() - 86_400_000);
  });

  it('the overview counts waiting requests for the sidebar badge, the same number the dashboard reports', async () => {
    const res = await http().get('/admin/overview').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body.data.waitingAsks).toBeGreaterThanOrEqual(2);
    const dash = await http().get('/admin/dashboard').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(dash.body.data.asksWaiting).toBe(res.body.data.waitingAsks);
    expect(dash.body.data.asks.length).toBe(Math.min(20, dash.body.data.asksWaiting));
  });
});
