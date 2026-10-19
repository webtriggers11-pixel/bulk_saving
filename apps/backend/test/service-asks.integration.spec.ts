import { INestApplication } from '@nestjs/common';
import { NotificationType, type Resident, type Service, type Society } from '@prisma/client';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { RoundsAdminService } from '../src/modules/rounds/rounds-admin.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * "Ask for this service" end to end (FEAT-022, ADR-0033), against real Postgres + Redis:
 * asking is idempotent and per society; it is refused while a round is open; opening a
 * round notifies exactly the residents who asked — in the same transaction — and clears
 * their asks; the admin dashboard lists what is being asked for.
 */
describe('Service asks (FEAT-022)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: CapturingChannel;
  let society: Society;
  let other: Society;
  let service: Service;
  let otherOnly: Service;
  let alice: Resident;
  let bob: Resident;
  let carol: Resident;
  let outsider: Resident;
  let admin: Resident;
  const tokens: Record<string, string> = {};
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });
  const http = () => request(app.getHttpServer());

  async function waitFor<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 8_000): Promise<T> {
    const until = Date.now() + ms;
    for (;;) {
      const value = await read();
      if (ok(value) || Date.now() > until) return value;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  beforeAll(async () => {
    sms = new CapturingChannel();
    app = await createTestApp(sms);
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
    society = await prisma.society.create({ data: { name: 'Ask Society', city: 'Pune', inviteCode: randomInviteCode() } });
    other = await prisma.society.create({ data: { name: 'Ask Other', city: 'Pune', inviteCode: randomInviteCode() } });
    service = await prisma.service.create({
      data: { name: 'Water Tank Cleaning', slug: `tank-${suffix}`, description: 'x', category: 'Utilities', active: true },
    });
    otherOnly = await prisma.service.create({
      data: { name: 'Other Only', slug: `other-${suffix}`, description: 'x', category: 'Home Care', active: true },
    });
    await prisma.serviceOffering.createMany({
      data: [
        { societyId: society.id, serviceId: service.id, enabled: true },
        { societyId: other.id, serviceId: service.id, enabled: true },
        { societyId: other.id, serviceId: otherOnly.id, enabled: true },
      ],
    });
    const mk = (societyId: string, name: string, role: 'RESIDENT' | 'SUPER_ADMIN' = 'RESIDENT') =>
      prisma.resident.create({ data: { societyId, phone: randomPhone(), name, role, verifiedAt: new Date() } });
    alice = await mk(society.id, 'Alice');
    bob = await mk(society.id, 'Bob');
    carol = await mk(society.id, 'Carol');
    outsider = await mk(other.id, 'Outsider');
    admin = await mk(society.id, 'Admin', 'SUPER_ADMIN');
    for (const [name, r] of Object.entries({ alice, bob, carol, outsider, admin })) {
      tokens[name] = (await auth.issueTokens(r)).accessToken;
    }
  });

  afterAll(async () => {
    await prisma.society.deleteMany({ where: { id: { in: [society.id, other.id] } } });
    await prisma.service.deleteMany({ where: { id: { in: [service.id, otherOnly.id] } } });
    await app.close();
  });

  const demandIn = async (who: string) => {
    const res = await http().get('/catalog').set(as(who)).expect(200);
    return (res.body.data.items as Array<{ id: string; demand: unknown }>).find((s) => s.id === service.id)?.demand;
  };

  it('asking is idempotent, counted per society, and each resident sees whether they asked', async () => {
    const first = await http().post(`/catalog/${service.id}/ask`).set(as('alice')).expect(200);
    expect(first.body.data).toEqual({ askCount: 1, askedByMe: true });
    await http().post(`/catalog/${service.id}/ask`).set(as('alice')).expect(200); // again: still one
    await http().post(`/catalog/${service.id}/ask`).set(as('bob')).expect(200);

    expect(await demandIn('alice')).toEqual({ askCount: 2, askedByMe: true });
    expect(await demandIn('carol')).toEqual({ askCount: 2, askedByMe: false });
    // The other society offers the same service: its count is its own.
    expect(await demandIn('outsider')).toEqual({ askCount: 0, askedByMe: false });
  });

  it('withdrawing takes back only your own ask', async () => {
    await http().post(`/catalog/${service.id}/ask`).set(as('carol')).expect(200);
    const res = await http().delete(`/catalog/${service.id}/ask`).set(as('carol')).expect(200);
    expect(res.body.data).toEqual({ askCount: 2, askedByMe: false });
  });

  it('a service this society does not offer cannot be asked for (404, like any unknown id)', async () => {
    await http().post(`/catalog/${otherOnly.id}/ask`).set(as('alice')).expect(404);
    await http().post('/catalog/not-a-service/ask').set(as('alice')).expect(404);
  });

  it('the admin dashboard lists what residents are asking for', async () => {
    const res = await http().get('/admin/dashboard').set(as('admin')).expect(200);
    const row = (res.body.data.asks as Array<{ service: { id: string }; society: { id: string }; askCount: number }>).find(
      (a) => a.service.id === service.id && a.society.id === society.id,
    );
    expect(row?.askCount).toBe(2);
  });

  it('opening a round tells exactly the residents who asked, clears their asks, and stops new asks', async () => {
    // The OTHER society offers the same service and has its own asker: a round opened here
    // must neither tell them nor clear their ask (V2 P2-1).
    await http().post(`/catalog/${service.id}/ask`).set(as('outsider')).expect(200);
    const rounds = app.get(RoundsAdminService);
    const round = await rounds.createRound(
      {
        societyId: society.id,
        serviceId: service.id,
        deadline: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(),
        tiers: [{ threshold: 5, price: 800 }],
      },
      admin.id,
    );

    const staged = await prisma.notification.findMany({
      where: { roundId: round.id, type: NotificationType.SERVICE_ASK_OPENED },
      select: { residentId: true, body: true },
    });
    expect(staged.map((n) => n.residentId).sort()).toEqual([alice.id, bob.id].sort());
    expect(staged[0].body).toMatch(/You asked, and it is open — a Water Tank Cleaning group buy/);
    expect(await prisma.serviceAsk.count({ where: { societyId: society.id, serviceId: service.id } })).toBe(0);
    expect(await prisma.serviceAsk.count({ where: { residentId: outsider.id, serviceId: service.id } })).toBe(1);
    expect(staged.map((n) => n.residentId)).not.toContain(outsider.id);

    // Delivered through the outbox like any other message.
    await waitFor(async () => sms.messagesTo(alice.phone).length, (n) => n >= 1);
    expect(sms.messagesTo(alice.phone).join(' ')).toMatch(/You asked/);
    expect(sms.messagesTo(carol.phone).join(' ')).not.toMatch(/You asked/);

    // While it is open, ask is the wrong verb: join it.
    const refused = await http().post(`/catalog/${service.id}/ask`).set(as('carol')).expect(409);
    expect(refused.body.error.code).toBe('ROUND_ALREADY_OPEN');

    // The dashboard lists only what an admin can act on: this society's pair has a round
    // open now, so it is gone; the other society's ask is still waiting there.
    const dash = await http().get('/admin/dashboard').set(as('admin')).expect(200);
    const pairs = (dash.body.data.asks as Array<{ service: { id: string }; society: { id: string } }>).filter(
      (a) => a.service.id === service.id,
    );
    expect(pairs.map((a) => a.society.id)).toEqual([other.id]);

    // V2 r2 P2: an ask that slipped in while the round was opening (the READ COMMITTED
    // race the service comment describes) is not shown — that pair has a round open.
    await prisma.serviceAsk.create({ data: { residentId: carol.id, societyId: society.id, serviceId: service.id } });
    const raced = await http().get('/admin/dashboard').set(as('admin')).expect(200);
    expect(
      (raced.body.data.asks as Array<{ service: { id: string }; society: { id: string } }>).some(
        (a) => a.service.id === service.id && a.society.id === society.id,
      ),
    ).toBe(false);
  });

  it('asks for a service the society no longer offers are not on the to-do list (V2 r2 P2)', async () => {
    // `other` still has the outsider's waiting ask; withdraw the offering there.
    await prisma.serviceOffering.updateMany({ where: { societyId: other.id, serviceId: service.id }, data: { enabled: false } });
    const res = await http().get('/admin/dashboard').set(as('admin')).expect(200);
    expect(
      (res.body.data.asks as Array<{ service: { id: string }; society: { id: string } }>).some(
        (a) => a.service.id === service.id && a.society.id === other.id,
      ),
    ).toBe(false);
    await prisma.serviceOffering.updateMany({ where: { societyId: other.id, serviceId: service.id }, data: { enabled: true } });
  });
});
