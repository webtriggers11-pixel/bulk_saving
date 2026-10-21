# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Latest session (2026-10-21, continued: a proper PWA — FEAT-029 + BUG-025, same branch)

- **FEAT-029 closed** (owner: "make this as prper pwa app", "web app"). ADR-0041.
  - **Icons:** `apps/web/pwa-assets/mark.svg` (the app's bolt) feeds `scripts/gen-pwa-assets.mjs`, which uses sharp through Astro, so no new dependency. It renders any/maskable 192/512, apple-touch 180, favicons, shortcut icons and 10 iOS launch images. Re-run it if the mark changes.
  - **Manifest:** `src/pwa/manifest.ts` (Mono colours, id, shortcuts, screenshots captured from the real app, orientation any). SW settings are in `src/pwa/config.ts`.
  - **Install card** on Home. **Font runtime caching** (no API caching).
  - **Browser pass found:** the SW registered only inside the resident AppShell, so sign-in and /admin were never covered. It now registers in `ServiceWorkerProvider` at the root.
  - V3 at 3c957d7: two identical runs, 21:03:34–21:04:29 and 21:04:29–21:05:22 (site 62, backend 566, web 689).
- **BUG-025 closed** (found by FEAT-029 V2): `registerType: 'autoUpdate'` reloaded every open page on each deploy and the update prompt could never show. Now `'prompt'`, and UpdatePrompt renders in AppShell and AdminLayout. Verified in Chrome across two builds: the page stays, the prompt shows, and Reload activates the new build.
- **CDP scripts** for screenshots, the install/offline check and the update flow are in the session scratchpad (`shots/capture.mjs`, `check.mjs`, `update.mjs`). They need the dev API on :3000 and a preview on :5175. Re-capture the screenshots if Home changes visibly.
- **Not done (nice-to-have):** dark-scheme launch images, a monochrome icon, a root render test pinning the provider mount.

## Earlier on 2026-10-21 (OTP length + dev `1111` — CHORE-026, on branch `feat/FEAT-027-whatsapp-tap-to-verify`)

- **CHORE-026 closed** (owner, in order: "for development use otp always 1111 for everyuser and admin" → "only 4 digit" →
  "That code has expired. Request a new one. fix this" → chose **B** on the security trade-off). ADR-0040.
  - **Residents' OTPs are 4 digits.** An administrator's number gets **8 digits** through EITHER door: the admin door sends 8 to
    every caller, and the society door asks `isAdminPhone` for every caller. Both DTOs accept `^(\d{4}|\d{8})$`. This
    ships CHORE-022 option 1; its option 3 (alerting) is still open.
  - **Dev:** `OTP_DEV_FIXED_CODE=1111` (in the local `apps/backend/.env`). When `NODE_ENV` is exactly `development`, every OTP
    is `1111`, and `1111` verifies even with no OTP outstanding. Tests and production ignore it, and production refuses to
    boot with it set. The admin-role check still runs after verify.
  - V3 at b757edf: two identical runs, 20:36:10–20:37:07 and 20:37:07–20:38:01 (site 62, backend 566, web 665).
- **Restart the dev API** to pick it up: `pnpm --filter backend dev`. The :3000 process was started from `dist/main` at 20:21.
- **New/updated bugs:**
  - BUG-024: `wa-login.integration.spec.ts` "switched off" fails whenever the local .env holds the Meta test credentials. Run
    gates in a worktree whose .env has no `WHATSAPP_*` lines (`grep -v '^WHATSAPP_'`).
  - BUG-014: hit again in V2 r2 (`POST /auth/admin/otp/request` → 404). The probe middleware stayed SILENT, so the 404 never
    reached the test app. Look at supertest and the HTTP server, not Nest routing.
- One node segfault (exit 139) mid-gate; a re-run was clean.

## Previous session (2026-10-20, the product website — FEAT-028, `apps/site`, on branch `feat/FEAT-027-whatsapp-tap-to-verify`)

- **BUG-023 closed:** the catalog chips' Flip collapsed the wall (`absolute: true`) so the section below jumped over the cards. Now `absoluteOnLeave` + a wall height tween on the Flip timeline + leavers stacked under movers; `h0` must be read before `Flip.getState` (it ends a running Flip). Guard: `apps/site/src/scene/catalog.flip.test.ts`. V3 at 77ce291, two identical runs (site 62, backend 557, web 665).
- **CHORE-025 closed (after FEAT-028):** owner saw "lot of empty spaces" — a mini card in every story step (desktop only;
  on phones a card pushed the caption under the sticky stage, V2 caught it), sticky side columns (Trust/Phone mocks, Look,
  calculator outputs), a second "Now" roadmap card (WhatsApp sign-in), 38vh captions, 88px sections. V1/V2/V3 green
  (de9001f, identical double run). The dev server on :4321 is still up for the owner.

- **FEAT-028 closed** (owner, in order: "create new folder in apps using astro … beautiful product website … 3d animation … same
  theme consistency, SPA is fine" → "make it creative and fancy as per theme" → "use GSAP, kens and much more animation 3d …
  use internet to search" → "Browse, ask, book … better UI/UX with fancy style" → "show this to my financiers … remove unwanted
  things, add positive product things, more interactive, good labels, get the idea in one go"). ADR-0039. Astro 7.4.1
  static one page; the app's tokens copied into `src/styles/tokens.css` and PINNED to `apps/web/src/styles/theme.css` by a
  test; content pinned to REGISTRY.md (every done FEAT on the page, internal FEAT-026 exempt, nothing unshipped sold) and the
  23-service catalog pinned to `apps/backend/prisma/seed.ts` by slug; GSAP 3.15 + Lenis 1.3.27 (SplitText hero entrance,
  scroll-scrubbed Three.js story in "How it works", reveals, parallax, Flip-filtered catalog wall with the app's pledge
  sheet as a `<dialog>`, circular scheme reveal, border beam/spotlight/sparkles/shimmer); financier pass: Overview "in one
  go" (mechanic, money flow, BRIEF numbers, who-gains-what tabs, why it holds), a six-slider savings calculator (commission
  labelled illustrative), Now/Next/Later roadmap replacing the "not here yet" table. 58 tests; four V2 rounds (every P1/P2
  taken; the phone-caption alignment took three rounds); V3 at 0de7347 identical double run (site 58, backend 557, web 665).
- **Run it:** `pnpm --filter site dev` → http://127.0.0.1:4321/ (the dev server was left RUNNING for the owner; `pkill -f
  'astro dev'` to stop). Production: `pnpm --filter site build` → `apps/site/dist` (static; DEPLOY.md §8; set `site` in
  `astro.config.mjs` first). Dev builds expose `window.bulkLenis` for browser passes; production strips it (tested).
- **Owner decisions pending:** (1) the whole item lives on the WhatsApp branch, not main — the other session had checked it
  out and staged files before this item's first commit, which swept 33 of those files (`6e31938`); merge the branch to main
  when the WhatsApp item is ready, history left as is. (2) `apps/site/astro.config.mjs` `site:` is a placeholder domain; the
  CTA mailto is `hello@bulksaving.example`. (3) BUG-020 stays triaged (dev-otp spec teardown race under concurrent gates).
- **Lessons recorded (memory + LOG):** two sessions in one tree — check `git log`/REGISTRY before taking an ID (both took
  FEAT-027/ADR-0038; the site became FEAT-028/ADR-0039), stage by path and check `git branch --show-current` +
  `git diff --cached` before committing, wait with the ANCHORED `pgrep -f '^bash scripts/verify.sh'` (the unanchored form
  deadlocks two waiters), run gates in a detached worktree when the other session's WIP breaks the main tree, and a
  daemonised `astro dev` can lose its optimised deps while a gate's Vitest runs (check `html.gsap` before a browser pass).
  Astro: a dependency reached only by dynamic `import()` needs `optimizeDeps.include` or the cold dev server 504s.
- **Machine:** global `pnpm` shim broken → scratchpad wrapper `exec corepack pnpm "$@"`; the owner's Chrome automation window
  was 500px wide this afternoon (phone pass for free; desktop checked with `document.documentElement.style.zoom`).

## Session before (2026-10-20, WhatsApp sign-in — branch `feat/FEAT-027-whatsapp-tap-to-verify`, NOT merged)

- **FEAT-027 closed on its own branch** (owner: "on different branch i want this feat and i want to test is this work or
  not … create new branch and do this and check"; later "for testing use my number - 8419997952"). "Tap to verify": the
  resident sends a pre-filled WhatsApp message to the business number; the signed webhook ties the sender's number to the
  browser's request; the business replies with three number buttons (one matches the screen); the right tap confirms; the
  browser polls `GET /auth/wa/status/:requestId` and gets the usual lifetime-session JWTs. Both doors; SMS OTP unchanged
  as the fallback; ADR-0038. V2 PASS-conditional (4 P2s landed, 11 P3s taken) and a V3 double run (backend 557/557,
  web 662/662, site 34/34, bundle guard green).
- **How to try it NOW (no Meta account):** the owner's API on :3000 is in STUB mode (`OTP_DEV_LOG=true`, no `WHATSAPP_*`),
  so any DEV web server shows "Continue with WhatsApp" and a "DEV ONLY · Simulate WhatsApp" panel on the step: type a
  number (the owner's +91 84199 97952 works), "Send the login message as this number", tap a button in the shown reply.
  Resident door with BLUE0002, admin door with +919999900209 — both done in Chrome this session. Not on the :5175 preview
  (production bundle: no simulator, by design — and `/auth/methods` is still true there, so the button shows but the real
  WhatsApp side is a dead number `910000000000`; that preview is a production build pointed at a stub-mode API).
- **How to try it with REAL WhatsApp (owner's job, ~30 min):** DEPLOY.md §2a — a Meta app in development mode gives a free
  test number + a 24 h token; set the five `WHATSAPP_*` vars (test number as `WHATSAPP_BUSINESS_NUMBER`), expose :3000
  with `cloudflared tunnel --url http://localhost:3000` (or ngrok), register `https://<tunnel>/webhooks/whatsapp` with
  the verify token, add +91 84199 97952 as a verified recipient, restart the API, open the PWA on that phone. Business
  verification (BRIEF R1) is what makes it production.
- **Known residuals (ADR-0038):** three buttons = 1-in-3 per lured message, bounded by 5 attaches/hour/phone (revisit:
  typed 2-digit reply); polling at 2 s is 30/min per browser under the global 120/min per address (ADR-0020's ceiling,
  not this item); status is a GET with the requestId in the path (`no-store`; move to POST if an edge proxy logs paths).
- **Two sessions shared this checkout and branch today.** The other one built the product website (FEAT-028, `apps/site`,
  ADR-0039; it renumbered itself after both took FEAT-027/ADR-0038 — I fixed its stale REGISTRY row). Its uncommitted
  `apps/site` edits broke `pnpm -r test` in the main tree for a while, so FEAT-027's V1/V3 ran on the COMMITTED tree in a
  detached worktree. It triaged **BUG-020** (dev-otp integration spec: unhandled ioredis "Connection is closed" from a
  BullMQ worker at teardown, 1 run in N, while gates overlapped) — that spec now boots `AppModule + DevToolsModule`
  (DevToolsModule imports AuthModule since FEAT-027), i.e. two full apps in one file; the fix belongs to BUG-020 (close
  the worker before the connection / swallow the teardown error). Its V1 also saw `useWhatsAppLogin` "polls pending →
  …" time out at 5 s under a concurrent gate → those waits are now 15 s. Rule going forward: `ps aux | grep verify.sh`
  before any gate; never two at once.
- **Machine:** global `pnpm` shim still broken → scratchpad wrapper `exec corepack pnpm "$@"`; owner's API `nest start
  --watch` on :3000 and Vite :5173 serve the working tree (so they already ran this branch); preview :5175 still up;
  my Vite :5174 stopped; review worktree removed. Dev admin +919999900209, resident +919999900201 / BLUE0002.
- **After close, two bugs on the same branch (owner screenshot + the flake the reviewers kept hitting):** BUG-021 — a short
  invite code reached the server and its 400 read as a PHONE error on the WhatsApp step, with no retry → the invite step
  lets only an 8-char code through, shows the invite hint only after a failed attempt (owner: "give error in invite code
  only if it's wrong"), the mapper names the field from the server's message, the step has "Try again". BUG-022 — the
  `useWhatsAppLogin` polling test raced `waitFor` (20 ms poll vs 50 ms look) and the hook had no `confirmed` phase → the
  test now advances the server's answer itself; the step says "You're in — one moment…". Both V2-reviewed; V3 double run at
  ebe4296: two identical green runs (backend 557/557, web 665/665, site 50/50). Setup runbook with Meta links: `WHATSAPP-SETUP.md`.
- **Open, unchanged:** BUG-014, CHORE-022 (owner), CHORE-023, CHORE-010/011/012/013; BUG-020 (other session's triage).

## Session before (2026-10-19 evening → 2026-10-20 early)

- **Closed (each with V2 + fixes and a V3 double run):** FEAT-020 (web push — T7 done: a real push through
  FCM shown by the SW; accent re-sync verified), BUG-017 (one session per DEVICE: `sid` in the refresh token,
  `refresh:<rid>:<sid>` + `sessions:<rid>`, pre-fix tokens migrate on first rotation, `POST /auth/sign-out`;
  ADR-0034 amends ADR-0024; DEPLOY.md revocation updated), BUG-018 (flaky OTP test), FEAT-023 (Home leads
  with Group buys: accent lead card, live counts, three soonest rounds deep-linking into the pledge sheet),
  CHORE-024 (Profile: one settings list, one row shape), FEAT-024 (ConfirmSheet before log out / leave a
  round / remove a rating / admin cancel; always closable, honest offline — three V2 rounds).
- **Also closed:** FEAT-025 server-side pagination (ADR-0035: keyset pages on all six list endpoints,
  `{ items, nextCursor, total }`, `limit` 1–50 default 20, bad input 400, the Prisma cursor + `skip` trap
  handled, explicit "Show more" on every list, pickers walk all pages — three V2 rounds), BUG-019 phone
  normalisation (ADR-0036; two V2 rounds — the second found the DEV server broken, see below).
- **FEAT-026 (owner: "in dev mode otp send in toast msg in top")** — ADR-0037 amends ADR-0020: the code
  never rides on the auth response; a `GET /dev/otp` route whose module exists only under
  `OTP_DEV_LOG=true` + an explicit `NODE_ENV=development|test`, loopback callers only; the web reaches it
  through a dynamic `import()` behind a build-time constant, and `scripts/check-dev-only.mjs` fails the gate
  if any built asset contains it. Toast at the top, "DEV ONLY · Your code is 123456 · Use it" on both doors.
  Works on a DEV server (:5173 / :5174) — NOT on the :5175 preview (a production build, by design).
  Done: two V2 rounds (a dead branch in the bundle; default-open NODE_ENV) and a V3 double run.
- **One trap worth remembering:** the web's first RUNTIME import from `@bulk/shared` (CommonJS, linked
  outside node_modules) needs BOTH `build.commonjsOptions.include` (Rollup, caught by the gate) AND
  `optimizeDeps.include` (the dev server, NOT caught by the gate — the owner's `vite` on :5173 served raw
  CJS until the second was added). Building shared as ESM/dual would retire both (ADR-0036).
- **Owner asks this session → where they landed:** lifetime login per device → BUG-017 (done); "Group buys
  hidden on Home" → FEAT-023 (done); install card / clean Profile → CHORE-024 (done); confirmations →
  FEAT-024 (done); server-side pagination → FEAT-025 (done). Found on the way: BUG-019 (done).
- **Machine (this session):** global `pnpm` shim still broken → scratchpad wrapper `exec corepack pnpm "$@"`.
  NEVER two gates at once — the backend test apps share Redis and the `bull-test` queue; a second process's
  worker eats the first one's outbox jobs and a `service-asks` test fails with an empty SMS (looks like a
  product bug; it is not). A detached worktree at `<scratchpad>/wt-review` (`git worktree add --detach`,
  copy both `.env`s, `pnpm install --offline` ≈ 7s) gives the reviewer its own tree; its gate still counts
  as THE gate. The Chrome automation window is full-screen and will not resize (the app is a 448px column
  anyway). Preview :5175 serves `dist` from the last gate build; the installed SW needs
  `registration.update()` + reload. Dev residents: +919999900201 (Blue Waters),
  Ops admin +919999900209 via /admin/login. One-off: `git add -A` swept the owner's untracked FEATURES.md
  into a BUG-017 commit — add by path.

## Session before (2026-10-19, day)

- **Closed:** FEAT-017 (Vercel Mono look), FEAT-018 (rounds: ladder, summary, invite, confetti, live clock),
  FEAT-019 (one Vercel look + 7 accent pairs + micro-interactions), FEAT-021 (service cards book in one tap),
  FEAT-022 ("Ask for this service" + admin demand list + askers notified when a round opens), BUG-013 (admin
  OTP test race), BUG-015 + BUG-016 (phone view: no squeeze/overflow, aligned tile values, 18/22px card
  padding, 44px icon boxes, row-shaped service tiles under 400px, one-row admin nav — measured at 360/390/
  400/430/448px), BUG-012 (class gate parses TS — 3278 tokens checked, was 1922). Each with V2 + V3.
- **Open:** FEAT-020 web push — built, V2 PASS, V3 green; real delivery verified to the browser (FCM accepted,
  Chrome created the notifications) but the owner did not see banners — macOS notification settings for
  Chrome (Notification Center / System Settings → Notifications → Google Chrome / Focus). Mark T7 done once
  the owner sees one. Also the owner's call: cancel or keep the test round "Geyser Service" (Green Meadows,
  opened by the agent; the Platform Admin pledged 1).
- **Triaged:** BUG-014 (intermittent route-level 404 in backend integration tests under verify.sh — a probe in
  test/helpers/test-app.ts logs every 404; ~22 expected per run), CHORE-023 (class gate: static parts of
  `${}` templates), CHORE-022 (admin OTP strength — owner decision).
- **Machine:** global pnpm shim broken → scratchpad shim `exec corepack pnpm "$@"` + Node 24.22.0 for
  verify.sh. Ports: 5173 is ANOTHER project; Bulk Saving web on 5174 (owner dev server) and 5175 (agent's
  production PREVIEW — rebuild with `vite build` to update; it is what the push service worker runs on).
  API :3000 is the owner's `nest start --watch` — its watch mode stalls after schema changes; restart it.
  Dev admin: +919999900001 at /admin/login (full +91); OTP via `redis-cli -p 6399 get dev:last-otp:+91…`.
  Phone-width audits: same-origin iframes at 360/390px (the Chrome window will not go below 500px).

## Session before (2026-10-18)

- **Closed:** FEAT-016 — premium phone-app feel (ADR-0028). Night palette per colour
  theme; Light / Dark / Match phone + palette in a Profile → Appearance sheet; a
  Telegram-style circular reveal from the sun/moon switch (Home, Profile, admin header);
  bottom sheets for pledging (stepper + live tier price), rating and admin New service;
  collapsing large titles, safe-area insets, sliding tab pill. Browser-checked in both
  schemes at phone width; V2 two rounds (2×P1 + 13×P2 fixed); V3 two identical runs —
  backend 396/396, web 430/430.
- **Still open, needs the owner:** CHORE-022 (admin 8-digit codes / second factor).
- **Dev note:** a second backend beside the owner's :3000 must use its own
  `BULLMQ_PREFIX`, or the admin's queued sign-in code prints in the other terminal.

## Earlier (2026-10-17)

- **Closed today:** CHORE-018 (demo seed), FEAT-014 (admin Services, closed categories,
  staples pilot), CHORE-006, FEAT-015 (server-side filters + filtering UI), BUG-011 (error
  boundaries), CHORE-020, BUG-010 (residents see the negotiated price), CHORE-010, CHORE-011,
  CHORE-012, CHORE-013, CHORE-015 (phone index migration), CHORE-016 + CHORE-017
  (ADR-0027: per-client OTP budgets, per-door guess budgets, admin send queued for every
  caller), CHORE-019, CHORE-021 (Node 24.22.0 pinned). Final: three identical gate runs on
  Node 24.22.0 — backend 396/396, web 382/382.
- **Open, needs the owner:** CHORE-022 — admin sign-in is a 6-digit code over two doors
  (~30%/year under a sustained multi-address attack). Recommended: 8-digit admin codes +
  alerting on admin-phone lockouts.
- **Deploy notes added:** set `TRUST_PROXY` behind a reverse proxy (DEPLOY.md); the
  `Resident.phone` index migration is a plain CREATE INDEX (fine at this size).
- **Demo:** `pnpm --filter backend seed:demo` resets it. Asha Rao +919999900101 / GREEN001;
  Kabir +919999900108 (empty); admins +919999900001, +919999900209. OTPs in the API log.
- **Machine:** global `pnpm` shim broken — use `corepack pnpm`. `nvm use` selects 24.22.0
  here; the machine default is still 24.6.0. The owner's `nest start --watch` dev server
  runs on :3000 against the same Redis — the test suite now uses BullMQ prefix `bull-test`
  so the two no longer steal each other's jobs.

## Previous session

- **Date:** 2026-09-19
- **Goal:** Redesign the whole product on the approved design, then make it *properly
  work* — frontend only, no SMS, font provisional.
- **Result:** **FEAT-011, CHORE-008, BUG-007, BUG-008, BUG-009 and CHORE-009 closed.**
  Every screen in the product — six resident, four admin — is on one token layer, and
  every one of them has now been opened in a browser against the real API and had its
  controls driven. Six items remain open, all triaged, none blocking.

## Where the system lives

| | |
|---|---|
| Written system | `DESIGN-SYSTEM.md` (root) |
| Tokens, palettes, surfaces, motion | `apps/web/src/styles/theme.css` |
| Primitives (incl. the eight screen primitives) | `apps/web/src/components/ui/` |
| The canvas — one canvas, 18 boards, all 10 screens | `loop/work/FEAT-011-resident-ui-redesign/design/` · https://claude.ai/artifact/BbGhsSzNC47hds97Bg5gLe |
| What the browser showed, screen by screen | `loop/work/CHORE-009-design-parity-pass/findings.md` |
| Decisions | ADR-0021 (tokens + themes), ADR-0022 (screen primitives) |

## What this session is actually about

**Five defects shipped past a green suite, and every one was invisible to it for the
same reason: a test that reads source or config cannot verify a rendered style.**

| | What did nothing | Found by |
|---|---|---|
| FEAT-011 | `fill-*` collided with a Tailwind namespace | opening the app |
| FEAT-011 | 11 off-scale alpha steps | review |
| CHORE-008 | `Card` padding passed as a className | review |
| BUG-007 | 35 overrides on `CardTitle` / `Input` / `Skeleton` | the test written to find them |
| CHORE-009 | Profile's society, full-bleed strips, logout on a server hiccup | a browser |

Four guards now exist, **and three of them shipped broken first** — twice with the
identical bug (destructuring capture group 1 instead of group 2, so the scan inspected
nothing and reported success):

1. `scripts/check-css-classes.mjs` — gate step after build; every class must resolve to
   a rule in the BUILT stylesheet. Fails below an inspected-count floor.
2. `class-conflicts.test.tsx` — renders every primitive, reads the classes it really
   produces, fails if a caller passes one in the same CSS-property family. **Does not yet
   police letter-spacing — that is CHORE-012, and two fields already rely on luck.**
3. `primitives.test.tsx` — one owner per shape; `features → components/ui|lib`, never the
   reverse.
4. Opening the app. It found the first defect and the last three.

**If you add a fifth guard, give it a floor, and mutate it before trusting it.**

## Verification contract

`bash scripts/verify.sh` — shared types → prisma → lint → typecheck → build →
**css classes** → tests. Dev infra (`docker compose up -d`) must be up.

## What needs the owner

1. **BUG-010 (P1) — a resident is shown the wrong money.** The admin negotiated ₹700;
   the resident's delivered card says ₹900, because `RoundDto` has no `finalPrice`.
   Needs a shared DTO field + mapper, so it is backend work and was left alone.
2. **No SMS provider** — still the one thing that makes the product unusable in
   production rather than merely unhardened. DEPLOY.md §0. Out of scope by instruction.
3. **The webfont** stays a CDN link; the owner has said the font is provisional.
4. **CHORE-010** — "Unlocks ₹900 at 4 flats" when ₹900 is already the price. Needs a
   decision about what the first tier *means* before either the copy or the API is right.

## Open, triaged, not blocking

CHORE-006 (no admin services page) · **BUG-010 (P1, above)** · CHORE-010 · CHORE-011
(dev catalog full of E2E leftovers — clean before any demo) · CHORE-012 (letter-spacing
unpoliced) · CHORE-013 (act() warnings).

## Environment notes that cost time

- Ports 5173–5175 are taken by another project on this machine; the dev server lands on
  5199 and the API must then be started with `CORS_ORIGINS=http://localhost:5199`.
- OTP is 5 per phone per hour. For a browser pass, promote a second seeded resident to
  SUPER_ADMIN rather than burning the admin's quota.
- `/tmp/scenario.mjs` + `/tmp/scenario2.mjs` (this session) drive the public API to
  create a resident holding an open round, a delivered one to rate, and one nobody
  joined — every state the screens draw.
