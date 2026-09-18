#!/usr/bin/env node
/**
 * End-to-end smoke test: drives the WHOLE product through its real HTTP API,
 * the way a resident and the super-admin actually use it.
 *
 * This is not a unit or integration test — it is the "does the assembled system
 * work" check that `scripts/verify.sh` deliberately cannot be (verify drives Nest
 * in-process via supertest; this talks to a running server over the network, so it
 * also covers bootstrap, global wiring, CORS, guards and the queues).
 *
 * Requires: a running backend, Postgres + Redis up, the seed applied, and the server
 * started with OTP_DEV_LOG=true. Since CHORE-007 the API does NOT return the OTP —
 * `POST /auth/otp/request` is `{ requested: true }` in every environment — so this
 * harness reads the code from the dev-only Redis key the STUB SMS channel writes
 * (`dev:last-otp:<phone>`, 120s TTL). That key exists only while the stub adapter is
 * bound, i.e. never in production.
 *
 * It creates its own residents and rounds with a per-run suffix and cleans nothing up;
 * the dev DB is expected to accumulate.
 *
 * Usage:  node scripts/e2e-smoke.mjs [baseUrl]      (default http://localhost:3100)
 * Exit 0 = every scenario passed. Exit 1 = at least one failed (details printed).
 */

import { execFileSync } from 'node:child_process';

const BASE = process.argv[2] ?? process.env.E2E_BASE_URL ?? 'http://localhost:3100';

/** Seeded fixtures (apps/backend/prisma/seed.ts). */
const SOCIETY_A = 'GREEN001';
const SOCIETY_B = 'BLUE0002';
const SUPER_ADMIN_PHONE = '+919999900001';

const RUN = Date.now().toString().slice(-6);
const results = [];
let currentScenario = 'startup';

/* ------------------------------------------------------------------ plumbing */

async function api(path, { method = 'GET', body, token, expect: expected } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (expected !== undefined && res.status !== expected) {
    throw new Error(
      `${method} ${path} → expected ${expected}, got ${res.status}: ${JSON.stringify(payload)}`,
    );
  }
  return { status: res.status, body: payload, data: payload?.data, error: payload?.error };
}

function check(label, condition, detail = '') {
  if (condition) {
    results.push({ scenario: currentScenario, label, ok: true });
  } else {
    results.push({ scenario: currentScenario, label, ok: false, detail });
    console.log(`   ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    return;
  }
  console.log(`   ✓ ${label}`);
}

async function scenario(name, fn) {
  currentScenario = name;
  console.log(`\n▶ ${name}`);
  try {
    await fn();
  } catch (err) {
    results.push({ scenario: name, label: 'scenario threw', ok: false, detail: String(err.message ?? err) });
    console.log(`   ✗ scenario threw — ${err.message ?? err}`);
  }
}

/**
 * Read the OTP the stub SMS channel stashed for a phone (CHORE-007). Uses redis-cli
 * inside the compose container, so the harness needs no Redis client dependency.
 */
function readDevOtp(phone) {
  const port = process.env.REDIS_PORT ?? '6399';
  const out = execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'redis', 'redis-cli', 'GET', `dev:last-otp:${phone}`],
    { encoding: 'utf8' },
  ).trim();
  if (!out || out === '' || out === '(nil)') {
    throw new Error(
      `no dev OTP in Redis for ${phone} (key dev:last-otp:${phone}, port ${port}). ` +
        'Start the backend with OTP_DEV_LOG=true and make sure the stub SMS channel is bound.',
    );
  }
  return out;
}

/** Log in as a phone number in a society, via the dev-only OTP stash. */
async function login(inviteCode, phone, name) {
  await api('/auth/otp/request', {
    method: 'POST',
    body: { inviteCode, phone },
    expect: 200,
  });
  const code = readDevOtp(phone);
  const verified = await api('/auth/otp/verify', {
    method: 'POST',
    body: { inviteCode, phone, code, ...(name ? { name } : {}) },
    expect: 200,
  });
  return { token: verified.data.accessToken, refreshToken: verified.data.refreshToken, resident: verified.data.resident };
}

const phoneFor = (n) => `+9198${RUN}${String(n).padStart(2, '0')}`;

/* ----------------------------------------------------------------- scenarios */

async function main() {
  console.log(`E2E smoke against ${BASE} (run ${RUN})`);

  const state = {};

  await scenario('health + envelope', async () => {
    const health = await api('/health', { expect: 200 });
    check('GET /health is 200', health.status === 200);
    check('responses use the success envelope', health.body?.success === true, JSON.stringify(health.body));
  });

  await scenario('auth: onboarding a new resident', async () => {
    const bad = await api('/auth/otp/request', {
      method: 'POST',
      body: { inviteCode: 'NOSUCH01', phone: phoneFor(1) },
    });
    check('unknown invite code is refused', bad.status === 400, `status ${bad.status}`);
    check('…with INVALID_INVITE_CODE', bad.error?.code === 'INVALID_INVITE_CODE', JSON.stringify(bad.error));

    const alice = await login(SOCIETY_A, phoneFor(1), 'E2E Alice');
    state.alice = alice;
    check('a new resident can verify and gets tokens', Boolean(alice.token));
    check('the resident is bound to the invited society', Boolean(alice.resident?.societyId));
    check('role defaults to RESIDENT', alice.resident?.role === 'RESIDENT', alice.resident?.role);

    const me = await api('/me', { token: alice.token, expect: 200 });
    check('GET /me returns the caller', me.data?.resident?.id === alice.resident.id);
    check('GET /me includes the society', Boolean(me.data?.society?.name));

    const noAuth = await api('/me');
    check('GET /me without a token is 401', noAuth.status === 401, `status ${noAuth.status}`);
  });

  await scenario('auth: a wrong code is rejected, and no code leaks into an error', async () => {
    // A FRESH OTP: verifying against a consumed one correctly reports EXPIRED, so
    // asserting INVALID needs an outstanding code. (Both paths are checked here.)
    const phone = phoneFor(4);
    const stale = await api('/auth/otp/verify', {
      method: 'POST',
      body: { inviteCode: SOCIETY_A, phone, code: '000000' },
    });
    check('verifying with no outstanding OTP is 400', stale.status === 400, `status ${stale.status}`);
    check('…and reports OTP_EXPIRED', stale.error?.code === 'OTP_EXPIRED', JSON.stringify(stale.error));

    const requested = await api('/auth/otp/request', {
      method: 'POST',
      body: { inviteCode: SOCIETY_A, phone },
      expect: 200,
    });
    // CHORE-007: the response carries the acknowledgement and NOTHING else.
    check('the request response never carries the code', JSON.stringify(requested.data) === '{"requested":true}', JSON.stringify(requested.data));
    const real = readDevOtp(phone);
    const wrong = real === '000000' ? '111111' : '000000';
    const verify = await api('/auth/otp/verify', {
      method: 'POST',
      body: { inviteCode: SOCIETY_A, phone, code: wrong },
    });
    check('a wrong code against a live OTP is 400', verify.status === 400, `status ${verify.status}`);
    check('…and reports OTP_INVALID', verify.error?.code === 'OTP_INVALID', JSON.stringify(verify.error));
    check('the error body never carries the code', !JSON.stringify(verify.body).includes(real));
  });

  await scenario('admin: super-admin can reach the admin API, a resident cannot', async () => {
    const admin = await login(SOCIETY_A, SUPER_ADMIN_PHONE);
    state.admin = admin;
    check('super-admin logs in', Boolean(admin.token));
    check('…and carries the SUPER_ADMIN role', admin.resident?.role === 'SUPER_ADMIN', admin.resident?.role);

    const dash = await api('/admin/dashboard', { token: admin.token, expect: 200 });
    check('GET /admin/dashboard works for the admin', Boolean(dash.data?.statusCounts));

    const denied = await api('/admin/dashboard', { token: state.alice.token });
    check('…and is 403 for a resident', denied.status === 403, `status ${denied.status}`);

    const societies = await api('/admin/societies', { token: admin.token, expect: 200 });
    state.societyA = societies.data.find((s) => s.inviteCode === SOCIETY_A);
    state.societyB = societies.data.find((s) => s.inviteCode === SOCIETY_B);
    check('both seeded societies are listed', Boolean(state.societyA && state.societyB));
  });

  await scenario('catalog: a resident sees their society services', async () => {
    const services = await api('/catalog', { token: state.alice.token, expect: 200 });
    state.services = services.data;
    check('the catalog is non-empty', Array.isArray(services.data) && services.data.length > 0, `${services.data?.length}`);
    check(
      'every entry has a name',
      services.data.every((s) => typeof s.name === 'string' && s.name.length > 0),
      JSON.stringify(services.data?.[0]),
    );
  });

  await scenario('units: the service’s own unit label reaches the resident (FEAT-010)', async () => {
    // Painting is the service that made FEAT-010 necessary: "2 units of Painting" is
    // meaningless, and the resident is billed finalPrice x units.
    const admin = state.admin.token;
    const painting = await api('/admin/services', { token: admin, expect: 200 }).then((res) =>
      res.data.find((s) => s.slug === 'painting'),
    );
    check('the seeded Painting service exists', Boolean(painting), 'seed may not have run');
    check('…and its unit is a room, not a "unit"', painting?.unitLabel === 'room', JSON.stringify(painting?.unitLabel));
    check('…with a stored plural rather than a derived one', painting?.unitLabelPlural === 'rooms', JSON.stringify(painting?.unitLabelPlural));
    check('…and a scope sentence that settles what one room includes', typeof painting?.unitDescription === 'string' && painting.unitDescription.length > 10, JSON.stringify(painting?.unitDescription));

    // And the label travels on the round DTO a resident actually reads, so no screen
    // needs a second request for it.
    const feed = await api('/rounds', { token: state.alice.token, expect: 200 });
    const anyRound = feed.data[0];
    check('a resident round carries its service unit label', typeof anyRound?.service?.unitLabel === 'string' && anyRound.service.unitLabel.length > 0, JSON.stringify(anyRound?.service));
  });

  await scenario('round lifecycle: open → join → close(met) → assign → deliver → paid', async () => {
    const admin = state.admin.token;
    // A dedicated service for this run, so the one-OPEN-round-per-pair rule cannot clash.
    const slug = `e2e-${RUN}`;
    const created = await api('/admin/services', {
      method: 'POST',
      token: admin,
      body: {
        name: `E2E Service ${RUN}`,
        slug,
        description: 'Created by the E2E smoke run.',
        category: 'Home Care',
        unitLabel: 'room',
        unitLabelPlural: 'rooms',
        unitDescription: 'One room, for the E2E run.',
      },
      expect: 201,
    });
    state.service = created.data;
    check('admin can create a master service', Boolean(state.service?.id));
    check('…with the unit labels it was given', state.service?.unitLabel === 'room' && state.service?.unitLabelPlural === 'rooms', JSON.stringify(state.service?.unitLabel));

    const offering = await api(`/admin/societies/${state.societyA.id}/offerings/${state.service.id}`, {
      method: 'PUT',
      token: admin,
      body: { indicativePrice: 999, enabled: true },
    });
    check('…and offer it to a society', offering.status === 200 || offering.status === 201, `status ${offering.status}: ${JSON.stringify(offering.error)}`);

    const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const round = await api('/admin/rounds', {
      method: 'POST',
      token: admin,
      body: {
        societyId: state.societyA.id,
        serviceId: state.service.id,
        deadline,
        tiers: [
          { threshold: 2, price: 900 },
          { threshold: 4, price: 700 },
        ],
      },
      expect: 201,
    });
    state.round = round.data;
    check('admin opens a round', state.round?.status === 'OPEN', state.round?.status);
    check('…priced at the first tier before anyone joins', state.round?.currentPrice === 900, String(state.round?.currentPrice));

    // Two residents join; the second one meets the threshold.
    const bob = await login(SOCIETY_A, phoneFor(2), 'E2E Bob');
    state.bob = bob;
    const join1 = await api(`/rounds/${state.round.id}/join`, {
      method: 'POST',
      token: state.alice.token,
      body: { units: 1 },
      expect: 201,
    });
    check('a resident joins', join1.data?.myUnits === 1, JSON.stringify(join1.data?.myUnits));
    check('the live counter moves', join1.data?.unitsCount === 1, String(join1.data?.unitsCount));

    const join2 = await api(`/rounds/${state.round.id}/join`, {
      method: 'POST',
      token: bob.token,
      body: { units: 3 },
      expect: 201,
    });
    check('a second resident joins', join2.data?.unitsCount === 4, String(join2.data?.unitsCount));
    check('the tier price unlocks at the threshold', join2.data?.currentPrice === 700, String(join2.data?.currentPrice));

    const listed = await api('/rounds', { token: state.alice.token, expect: 200 });
    check('the round appears in the society feed', listed.data.some((r) => r.id === state.round.id));

    const closed = await api(`/admin/rounds/${state.round.id}/close`, { method: 'POST', token: admin, expect: 201 });
    check('admin closes the round as MET', closed.data?.status === 'CLOSED_MET', closed.data?.status);

    const vendor = await api('/admin/vendors', {
      method: 'POST',
      token: admin,
      body: { name: `E2E Vendor ${RUN}`, phone: phoneFor(9), category: 'Home Care' },
      expect: 201,
    });
    state.vendor = vendor.data;
    check('admin creates a vendor', Boolean(state.vendor?.id));

    const assigned = await api(`/admin/rounds/${state.round.id}/assign`, {
      method: 'POST',
      token: admin,
      body: { vendorId: state.vendor.id, finalPrice: 650 },
      expect: 201,
    });
    check('admin assigns the vendor', assigned.data?.status === 'ASSIGNED', assigned.data?.status);

    const detail = await api(`/admin/rounds/${state.round.id}`, { token: admin, expect: 200 });
    check('the detail shows the vendor and final price', detail.data?.vendor?.id === state.vendor.id && detail.data?.finalPrice === 650);
    check('…and both participants', detail.data?.participants?.length === 2, String(detail.data?.participants?.length));
    const alicePart = detail.data.participants.find((p) => p.resident.id === state.alice.resident.id);
    check('amount due is finalPrice × units', alicePart?.amountDue === 650, String(alicePart?.amountDue));

    const paid = await api(`/admin/rounds/${state.round.id}/participants/${alicePart.id}/payment`, {
      method: 'PUT',
      token: admin,
      body: { collected: true },
      expect: 200,
    });
    check('admin records a collected payment', paid.data?.paymentCollected === true);

    const delivered = await api(`/admin/rounds/${state.round.id}/deliver`, { method: 'POST', token: admin, expect: 201 });
    check('admin marks it delivered', delivered.data?.status === 'DELIVERED', delivered.data?.status);
  });

  await scenario('round rules: illegal moves are refused', async () => {
    const admin = state.admin.token;
    const again = await api(`/admin/rounds/${state.round.id}/assign`, {
      method: 'POST',
      token: admin,
      body: { vendorId: state.vendor.id, finalPrice: 650 },
    });
    check('re-assigning a DELIVERED round is 409', again.status === 409, `status ${again.status}`);
    check('…with INVALID_ROUND_TRANSITION', again.error?.code === 'INVALID_ROUND_TRANSITION', JSON.stringify(again.error));

    const joinClosed = await api(`/rounds/${state.round.id}/join`, {
      method: 'POST',
      token: state.alice.token,
      body: { units: 1 },
    });
    check('joining a closed round is 409', joinClosed.status === 409, `status ${joinClosed.status}`);
    check('…with ROUND_CLOSED', joinClosed.error?.code === 'ROUND_CLOSED', JSON.stringify(joinClosed.error));

    const badUnits = await api('/rounds/does-not-exist/join', {
      method: 'POST',
      token: state.alice.token,
      body: { units: 0 },
    });
    check('units must be >= 1 (validation before lookup)', badUnits.status === 400, `status ${badUnits.status}`);
  });

  await scenario('tenant isolation: another society cannot see or touch the round', async () => {
    const outsider = await login(SOCIETY_B, phoneFor(3), 'E2E Outsider');
    state.outsider = outsider;

    const feed = await api('/rounds', { token: outsider.token, expect: 200 });
    check('the other society does not see the round', !feed.data.some((r) => r.id === state.round.id));

    const join = await api(`/rounds/${state.round.id}/join`, {
      method: 'POST',
      token: outsider.token,
      body: { units: 1 },
    });
    check('…and cannot join it (404, not 403)', join.status === 404, `status ${join.status}`);
  });

  await scenario('delivery: the round is fully settled before rating', async () => {
    // NOTE: this scenario does NOT verify notifications. There is no admin API for
    // the outbox (FEAT-006 kept it internal), so nothing here can observe a staged
    // message; that is asserted directly against the DB in the integration suite.
    // What this checks is the state the outbox hangs off.
    const detail = await api(`/admin/rounds/${state.round.id}`, { token: state.admin.token, expect: 200 });
    check('the round is DELIVERED at the end of the lifecycle', detail.data?.status === 'DELIVERED', detail.data?.status);
    check('delivery is timestamped', Boolean(detail.data?.deliveredAt));
    check('payments are summarised', typeof detail.data?.payments?.collectedAmount === 'number');
    // Captured BEFORE the rating scenario moves this round to RATED, so the
    // dashboard check later is about THIS run rather than leftover data.
    state.deliveredCountAtDelivery = (
      await api('/admin/dashboard', { token: state.admin.token, expect: 200 })
    ).data.statusCounts.DELIVERED;
    check('this run contributes to the DELIVERED count', state.deliveredCountAtDelivery >= 1, String(state.deliveredCountAtDelivery));
  });

  await scenario('rating: a participant rates the delivered job (FEAT-007)', async () => {
    const roundId = state.round.id;

    // A resident of the society who never joined cannot rate it.
    const stranger = await login(SOCIETY_A, phoneFor(5), 'E2E Stranger');
    const strangerRate = await api(`/rounds/${roundId}/rating`, {
      method: 'PUT',
      token: stranger.token,
      body: { stars: 5 },
    });
    check('a non-participant is refused', strangerRate.status === 403, `status ${strangerRate.status}`);
    check('…with NOT_A_PARTICIPANT', strangerRate.error?.code === 'NOT_A_PARTICIPANT', JSON.stringify(strangerRate.error));

    // Another society cannot even see it.
    const outsiderRate = await api(`/rounds/${roundId}/rating`, {
      method: 'PUT',
      token: state.outsider.token,
      body: { stars: 5 },
    });
    check('another society gets 404, not 403', outsiderRate.status === 404, `status ${outsiderRate.status}`);

    // Validation.
    const bad = await api(`/rounds/${roundId}/rating`, {
      method: 'PUT',
      token: state.alice.token,
      body: { stars: 6 },
    });
    check('stars above 5 are rejected', bad.status === 400, `status ${bad.status}`);

    // The real thing: the first rating closes the lifecycle.
    const rated = await api(`/rounds/${roundId}/rating`, {
      method: 'PUT',
      token: state.alice.token,
      body: { stars: 5, comment: 'Prompt and tidy.' },
      expect: 200,
    });
    check('a participant rates the delivered round', rated.data?.stars === 5, JSON.stringify(rated.data));
    check('the comment is stored', rated.data?.comment === 'Prompt and tidy.');

    const afterFirst = await api(`/admin/rounds/${roundId}`, { token: state.admin.token, expect: 200 });
    check('the first rating moves the round to RATED', afterFirst.data?.status === 'RATED', afterFirst.data?.status);

    // A second participant rates; status must not move again.
    await api(`/rounds/${roundId}/rating`, {
      method: 'PUT',
      token: state.bob.token,
      body: { stars: 4 },
      expect: 200,
    });
    const afterSecond = await api(`/admin/rounds/${roundId}`, { token: state.admin.token, expect: 200 });
    check('a second rating does not re-transition', afterSecond.data?.status === 'RATED', afterSecond.data?.status);
    check('the round average is the mean of both', afterSecond.data?.ratings?.average === 4.5, JSON.stringify(afterSecond.data?.ratings));
    check('…over a count of 2', afterSecond.data?.ratings?.count === 2, String(afterSecond.data?.ratings?.count));

    const aliceRow = afterSecond.data.participants.find((p) => p.resident.id === state.alice.resident.id);
    check('the admin sees who said what', aliceRow?.rating?.stars === 5 && aliceRow?.rating?.comment === 'Prompt and tidy.');

    // The resident's own view.
    const mine = await api('/rounds/mine', { token: state.alice.token, expect: 200 });
    const mineRow = mine.data.find((r) => r.id === roundId);
    check('GET /rounds/mine shows the delivered round', Boolean(mineRow), `${mine.data?.length} rounds`);
    check('…carrying the caller’s own rating', mineRow?.myRating?.stars === 5, JSON.stringify(mineRow?.myRating));
    check('…and their own units', mineRow?.myUnits === 1, String(mineRow?.myUnits));

    // Editing replaces rather than duplicating.
    const edited = await api(`/rounds/${roundId}/rating`, {
      method: 'PUT',
      token: state.alice.token,
      body: { stars: 3 },
      expect: 200,
    });
    check('a resident can revise their rating', edited.data?.stars === 3);
    const afterEdit = await api(`/admin/rounds/${roundId}`, { token: state.admin.token, expect: 200 });
    check('…and the count does not grow', afterEdit.data?.ratings?.count === 2, String(afterEdit.data?.ratings?.count));

    // Vendor accountability.
    const vendors = await api('/admin/vendors', { token: state.admin.token, expect: 200 });
    const thisVendor = vendors.data.find((v) => v.id === state.vendor.id);
    check('the vendor carries an average rating', typeof thisVendor?.averageRating === 'number', JSON.stringify(thisVendor?.averageRating));
    check('…with the count it is based on', thisVendor?.ratingCount === 2, String(thisVendor?.ratingCount));

    // Withdrawing a rating must not roll the status back.
    const removed = await api(`/rounds/${roundId}/rating`, { method: 'DELETE', token: state.alice.token });
    check('a resident can withdraw their rating', removed.status === 204, `status ${removed.status}`);
    const afterDelete = await api(`/admin/rounds/${roundId}`, { token: state.admin.token, expect: 200 });
    check('the round stays RATED after a withdrawal', afterDelete.data?.status === 'RATED', afterDelete.data?.status);
    check('…and the count drops to 1', afterDelete.data?.ratings?.count === 1, String(afterDelete.data?.ratings?.count));
  });

  await scenario('dashboard: aggregates reflect the run', async () => {
    const dash = await api('/admin/dashboard', { token: state.admin.token, expect: 200 });
    check('every status key is present', Object.keys(dash.data.statusCounts).length === 7, String(Object.keys(dash.data.statusCounts).length));
    // This run's round is RATED by now, so asserting DELIVERED >= 1 here would pass
    // only on leftover data from earlier runs. Assert what this run actually produced.
    check('this run shows up as a RATED round', dash.data.statusCounts.RATED >= 1, String(dash.data.statusCounts.RATED));
    const society = dash.data.demandBySociety.find((d) => d.society.id === state.societyA.id);
    check('the society appears in demand', Boolean(society));
    check('collected payments include this run', dash.data.payments.collectedAmount >= 650, String(dash.data.payments.collectedAmount));
    check('the BRIEF success metric is reported', dash.data.ratings?.count >= 1, JSON.stringify(dash.data.ratings));
    check('…as an average out of 5', dash.data.ratings.average > 0 && dash.data.ratings.average <= 5, String(dash.data.ratings.average));
  });

  /* ------------------------------------------------------------- the report */

  // A thrown scenario is one failure, which would otherwise silently shrink the
  // denominator and make a partial run look like a smaller, greener one.
  const EXPECTED_CHECKS = 83;
  if (results.length < EXPECTED_CHECKS) {
    results.push({
      scenario: 'harness',
      label: `ran ${results.length} checks, expected at least ${EXPECTED_CHECKS} — a scenario bailed early`,
      ok: false,
    });
  }

  const failed = results.filter((r) => !r.ok);
  const byScenario = [...new Set(results.map((r) => r.scenario))];
  console.log('\n────────────────────────────────────────');
  console.log(`${results.length - failed.length}/${results.length} checks passed across ${byScenario.length} scenarios`);
  if (failed.length > 0) {
    console.log('\nFAILURES:');
    for (const f of failed) {
      console.log(`  • [${f.scenario}] ${f.label}${f.detail ? ` — ${f.detail}` : ''}`);
    }
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E harness crashed:', err);
  process.exit(1);
});
