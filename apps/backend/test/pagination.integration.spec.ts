import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from '@bulk/shared';
import type { Page } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * FEAT-025 (ADR-0035): every list is a page. Keyset on (order, id): exactly `limit` rows,
 * a cursor that continues without a gap or a repeat even when a row is inserted between
 * calls, `nextCursor: null` on the last page, `total` = the filtered count, tenancy on
 * every page, and bad input as 400 — never 500.
 */
describe('Pagination (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let society: Society;
  let other: Society;
  let residentToken: string;
  let adminToken: string;
  let resident: Resident;
  const tag = `pg${randomInviteCode().toLowerCase()}`;
  const serviceIds: string[] = [];
  const vendorIds: string[] = [];

  const server = () => app.getHttpServer();
  const get = (path: string, token = residentToken) => request(server()).get(path).set('Authorization', `Bearer ${token}`);

  /** Walk every page of `path`, asserting the contract on the way. */
  async function walk<T extends { id: string }>(path: string, limit: number, token = residentToken): Promise<{ items: T[]; pages: number; total: number }> {
    const items: T[] = [];
    let cursor: string | null = null;
    let pages = 0;
    let total = -1;
    for (;;) {
      const url = `${path}${path.includes('?') ? '&' : '?'}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const res = await get(url, token).expect(200);
      const page = res.body.data as Page<T>;
      pages += 1;
      total = page.total;
      expect(page.items.length).toBeLessThanOrEqual(limit);
      items.push(...page.items);
      if (page.nextCursor === null) {
        break;
      }
      expect(page.items.length).toBe(limit);
      expect(page.nextCursor).toBe(page.items[page.items.length - 1].id);
      cursor = page.nextCursor;
      if (pages > 50) throw new Error('runaway pagination');
    }
    return { items, pages, total };
  }

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
    society = await prisma.society.create({ data: { name: `Page ${tag}`, city: 'Pune', inviteCode: randomInviteCode() } });
    other = await prisma.society.create({ data: { name: `Other ${tag}`, city: 'Pune', inviteCode: randomInviteCode() } });
    resident = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() } });
    const admin = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() } });
    residentToken = (await auth.issueTokens(resident)).accessToken;
    adminToken = (await auth.issueTokens(admin)).accessToken;

    // 7 services offered in the society (and one in the other society, which must never
    // appear), each with an OPEN round the resident has joined → 7 open rounds, 7 mine.
    for (let n = 0; n < 7; n += 1) {
      const service = await prisma.service.create({
        data: { name: `${tag} Service ${String.fromCharCode(65 + n)}`, slug: `${tag}-${n}`, description: 'x', category: 'Home Care' },
      });
      serviceIds.push(service.id);
      await prisma.serviceOffering.create({ data: { societyId: society.id, serviceId: service.id, enabled: true } });
      const round = await prisma.round.create({
        data: {
          societyId: society.id, serviceId: service.id, deadline: new Date(Date.now() + 86_400_000), unitsCount: 1,
          tiers: { create: [{ threshold: 5, price: 500 }] },
          participants: { create: [{ residentId: resident.id, units: 1 }] },
        },
      });
      void round;
    }
    const foreign = await prisma.service.create({ data: { name: `${tag} Foreign`, slug: `${tag}-f`, description: 'x', category: 'Home Care' } });
    serviceIds.push(foreign.id);
    await prisma.serviceOffering.create({ data: { societyId: other.id, serviceId: foreign.id, enabled: true } });
    await prisma.round.create({
      data: { societyId: other.id, serviceId: foreign.id, deadline: new Date(Date.now() + 86_400_000), tiers: { create: [{ threshold: 5, price: 500 }] } },
    });
    for (let n = 0; n < 5; n += 1) {
      const vendor = await prisma.vendor.create({ data: { name: `${tag} Vendor ${n}`, phone: randomPhone(), category: 'Home Care', active: n % 2 === 0 } });
      vendorIds.push(vendor.id);
    }
  });

  afterAll(async () => {
    await prisma.society.deleteMany({ where: { id: { in: [society.id, other.id] } } });
    await prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await app.close();
  });

  it('GET /rounds pages the open rounds of the caller’s society and nothing else', async () => {
    const { items, pages, total } = await walk<{ id: string; service: { name: string } }>('/rounds', 3);
    expect(total).toBe(7);
    expect(pages).toBe(3);
    expect(new Set(items.map((r) => r.id)).size).toBe(7);
    expect(items.every((r) => r.service.name.startsWith(tag))).toBe(true);
    expect(items.some((r) => r.service.name.includes('Foreign'))).toBe(false);
  });

  it('a row inserted between two pages neither repeats nor hides another (keyset, not offset)', async () => {
    const first = await get('/rounds?limit=3').expect(200);
    const page1 = first.body.data as Page<{ id: string }>;
    // A brand-new round lands at the TOP (newest first) — an offset page 2 would re-show
    // the row that got pushed down; a keyset page 2 continues after the cursor.
    const extra = await prisma.service.create({ data: { name: `${tag} Service Z`, slug: `${tag}-z`, description: 'x', category: 'Home Care' } });
    serviceIds.push(extra.id);
    await prisma.serviceOffering.create({ data: { societyId: society.id, serviceId: extra.id, enabled: true } });
    const inserted = await prisma.round.create({
      data: { societyId: society.id, serviceId: extra.id, deadline: new Date(Date.now() + 86_400_000), tiers: { create: [{ threshold: 5, price: 500 }] } },
    });
    try {
      const second = await get(`/rounds?limit=3&cursor=${page1.nextCursor}`).expect(200);
      const page2 = second.body.data as Page<{ id: string }>;
      const seen = new Set(page1.items.map((r) => r.id));
      expect(page2.items.some((r) => seen.has(r.id))).toBe(false);
      expect(page2.items.some((r) => r.id === inserted.id)).toBe(false);
      expect(page2.total).toBe(8);
    } finally {
      // Leave the fixture as it was: the round AND the service (cascades its offering).
      await prisma.round.delete({ where: { id: inserted.id } });
      await prisma.service.delete({ where: { id: extra.id } });
      serviceIds.splice(serviceIds.indexOf(extra.id), 1);
    }
  });

  it('a cursor row that stopped matching (the round closed) drops nothing (V2 P2)', async () => {
    const first = await get('/rounds?limit=2').expect(200);
    const page1 = first.body.data as Page<{ id: string }>;
    const all = (await get('/rounds?limit=50').expect(200)).body.data as Page<{ id: string }>;
    const cursorRound = page1.items[1];
    await prisma.round.update({ where: { id: cursorRound.id }, data: { status: 'CANCELLED' } });
    try {
      const second = await get(`/rounds?limit=2&cursor=${cursorRound.id}`).expect(200);
      const page2 = second.body.data as Page<{ id: string }>;
      // The very next OPEN round after the cursor comes first — not the one after it.
      const expectedNext = all.items[all.items.findIndex((r) => r.id === cursorRound.id) + 1];
      expect(page2.items[0].id).toBe(expectedNext.id);
      expect(page2.items).toHaveLength(2);
      expect(page2.total).toBe(all.total - 1);
    } finally {
      await prisma.round.update({ where: { id: cursorRound.id }, data: { status: 'OPEN' } });
    }
  });

  // The tiebreaker itself is asserted on the SOURCE (src/common/pagination.spec.ts): Prisma adds
  // an implicit id order on cursor queries, so this walk cannot tell it apart (V2 round 2).
  it('rows created in the same instant walk without a gap or a repeat', async () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    const made: string[] = [];
    const tieServices: string[] = [];
    for (let n = 0; n < 3; n += 1) {
      const service = await prisma.service.create({ data: { name: `${tag} Tie ${n}`, slug: `${tag}-tie-${n}`, description: 'x', category: 'Home Care' } });
      tieServices.push(service.id);
      await prisma.serviceOffering.create({ data: { societyId: society.id, serviceId: service.id, enabled: true } });
      const round = await prisma.round.create({
        data: { societyId: society.id, serviceId: service.id, deadline: new Date(Date.now() + 86_400_000), createdAt: at, tiers: { create: [{ threshold: 5, price: 500 }] } },
      });
      made.push(round.id);
    }
    try {
      const { items, total } = await walk<{ id: string }>('/rounds', 1);
      expect(total).toBe(10);
      expect(new Set(items.map((r) => r.id)).size).toBe(10);
      expect(made.every((id) => items.some((r) => r.id === id))).toBe(true);
    } finally {
      // Leave the fixture as it was: rounds, then the services (cascading their offerings).
      await prisma.round.deleteMany({ where: { id: { in: made } } });
      await prisma.service.deleteMany({ where: { id: { in: tieServices } } });
    }
  });

  it('GET /rounds/mine, /catalog page the same way; the last page says there is no more', async () => {
    const mine = await walk<{ id: string }>('/rounds/mine', 4);
    expect(mine.total).toBe(7);
    expect(mine.pages).toBe(2);
    expect(mine.items).toHaveLength(7);
    const catalog = await walk<{ id: string; name: string }>('/catalog', 2);
    expect(catalog.total).toBe(7);
    expect(catalog.pages).toBe(4);
    expect(catalog.items.map((s) => s.name)).toEqual([...catalog.items.map((s) => s.name)].sort());
    // Filters and pages together: the filtered total, not the whole.
    const filtered = await get(`/catalog?q=${encodeURIComponent('Service A')}&limit=2`).expect(200);
    expect(filtered.body.data.total).toBe(1);
    expect(filtered.body.data.nextCursor).toBeNull();
  });

  it('admin lists page too, with their filters, and nothing is capped any more', async () => {
    const rounds = await walk<{ id: string }>(`/admin/rounds?societyId=${society.id}`, 5, adminToken);
    expect(rounds.total).toBe(7);
    expect(rounds.pages).toBe(2);
    const services = await walk<{ id: string }>(`/admin/services?q=${tag}`, 3, adminToken);
    // Every service carrying the tag, including the one the keyset test added (its round is gone, it is not).
    expect(services.total).toBe(serviceIds.length);
    expect(services.pages).toBe(Math.ceil(serviceIds.length / 3));
    const vendors = await walk<{ id: string; active: boolean }>(`/admin/vendors?q=${tag}`, 2, adminToken);
    expect(vendors.total).toBe(5);
    // Active first, then by name — across page boundaries.
    expect(vendors.items.map((v) => v.active)).toEqual([true, true, true, false, false]);
    const active = await get(`/admin/vendors?q=${tag}&status=active&limit=2`, adminToken).expect(200);
    expect(active.body.data.total).toBe(3);
  });

  it('defaults to 20 per page, caps at 50, and refuses bad input with 400', async () => {
    const dflt = await get('/rounds').expect(200);
    expect(dflt.body.data.items.length).toBeLessThanOrEqual(PAGE_LIMIT_DEFAULT);
    expect(typeof dflt.body.data.total).toBe('number');
    for (const bad of [`limit=0`, `limit=${PAGE_LIMIT_MAX + 1}`, `limit=abc`, `limit=2.5`, `cursor=`]) {
      const res = await get(`/rounds?${bad}`).expect(400);
      expect(res.body.success).toBe(false);
    }
    // A cursor for a row that is gone: an empty page, never a 500.
    const gone = await get('/rounds?limit=3&cursor=no-such-id').expect(200);
    expect(gone.body.data.items).toEqual([]);
    expect(gone.body.data.nextCursor).toBeNull();
  });

  it('a resident cannot page into another society by cursor', async () => {
    const foreignRound = await prisma.round.findFirstOrThrow({ where: { societyId: other.id } });
    const res = await get(`/rounds?limit=50&cursor=${foreignRound.id}`).expect(200);
    const mine = (await get('/rounds?limit=50').expect(200)).body.data as Page<{ id: string }>;
    // The cursor names a row outside the caller's scope: the seek lands at its position in
    // the order, and `where` keeps the page inside the caller's society — a subset of their
    // own list, never the other society's rows.
    const ids = new Set(mine.items.map((r) => r.id));
    const items = res.body.data.items as Array<{ id: string }>;
    expect(items.every((r) => ids.has(r.id))).toBe(true);
    expect(items.some((r) => r.id === foreignRound.id)).toBe(false);
    expect(res.body.data.total).toBe(mine.total);
  });
});
