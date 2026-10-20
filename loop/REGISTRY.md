# WORK REGISTRY — every work item, tagged and tracked

> Single index of all features, bugs, and chores. The `triage` skill assigns
> IDs and adds rows; skills update Status as work moves. Never delete rows —
> this table is the project's history at a glance.

**ID format:** `FEAT-NNN` (feature) · `BUG-NNN` (bug) · `CHORE-NNN` (refactor/tooling/docs)
**Status flow:** `triaged → specced → planned → in-progress → in-review → done` (bugs: `triaged → reproduced → in-progress → in-review → done`)

| ID | Title | Status | Priority | Opened | Closed | Folder | Decisions |
|----|-------|--------|----------|--------|--------|--------|-----------|
| CHORE-001 | Monorepo scaffold + stack bootstrap (verify.sh, CI) | done | P1 | 2026-09-16 | 2026-09-16 | loop/work/CHORE-001-bootstrap-scaffold/ | ADR-0002, ADR-0005, ADR-0006 |
| FEAT-001 | Society onboarding + phone-OTP auth (multi-tenant foundation) | done | P1 | 2026-09-16 | 2026-09-16 | loop/work/FEAT-001-society-onboarding-otp-auth/ | ADR-0003, ADR-0007, ADR-0008 |
| FEAT-002 | Service catalog per society | done | P1 | 2026-09-16 | 2026-09-16 | loop/work/FEAT-002-service-catalog/ | ADR-0003, ADR-0009 |
| FEAT-003 | Group-buy rounds — join, units, tiers, live counter (core) | done | P1 | 2026-09-16 | 2026-09-17 | loop/work/FEAT-003-group-buy-rounds/ | ADR-0003, ADR-0004, ADR-0010 |
| FEAT-004 | Round lifecycle state machine + scheduled closing (BullMQ) | done | P1 | 2026-09-17 | 2026-09-17 | loop/work/FEAT-004-round-lifecycle-scheduler/ | ADR-0004, ADR-0011 |
| FEAT-005 | Super-admin dashboard — demand, assign vendor, mark delivered/paid | done | P1 | 2026-09-16 | 2026-09-17 | loop/work/FEAT-005-super-admin-dashboard/ | ADR-0003, ADR-0011, ADR-0012 |
| FEAT-006 | Notifications — SMS-first (OTP + round alerts) | done | P1 | 2026-09-16 | 2026-09-18 | loop/work/FEAT-006-notifications-sms/ | ADR-0013 |
| FEAT-007 | Post-service rating | done | P2 | 2026-09-16 | 2026-09-18 | loop/work/FEAT-007-post-service-rating/ | ADR-0017 |
| FEAT-008 | PWA shell — installable + offline-friendly | done | P2 | 2026-09-16 | 2026-09-18 | loop/work/FEAT-008-pwa-shell/ | ADR-0015, ADR-0016 |
| CHORE-005 | One offline rule, one place — resident views adopt lib/offline.ts | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-005-consolidate-offline-helpers/ | — |
| CHORE-002 | Dev-only: surface the OTP in a toast (gated, never in production) | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-002-dev-otp-toast/ | ADR-0016 |
| CHORE-003 | Live end-to-end smoke harness (scripts/e2e-smoke.mjs) | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-003-e2e-smoke-harness/ | — |
| CHORE-004 | verify.sh must also run the build (a broken build stayed green) | done | P1 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-004-verify-build-gate/ | — |
| FEAT-009 | Rating UI — resident rates from My Requests; admin sees averages | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/FEAT-009-rating-ui/ | ADR-0018 |
| BUG-004 | Offline: admin controls hang on "Saving…" forever (v5 pauses, never fails) | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/BUG-004-offline-paused-admin-controls/ | — |
| FEAT-010 | Per-service unit labels ("2 rooms", not "2 units") | done | P1 | 2026-09-18 | 2026-09-18 | loop/work/FEAT-010-per-service-units/ | ADR-0019 |
| CHORE-006 | Admin has no services page — the catalog is API-only | done (by FEAT-014) | P2 | 2026-09-18 | 2026-10-17 | loop/work/CHORE-006-admin-services-page/ | ADR-0009 |
| BUG-005 | Rare 401 in the admin integration suite — mitigated by BUG-006 | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/BUG-005-flaky-401-admin-suite/ | — |
| CHORE-007 | Production hardening — headers, rate limits, no auth bypass, Docker, CI, runbook | done | P0 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-007-production-hardening/ | ADR-0020 |
| BUG-006 | The backend gate could not pass twice in a row (parallel suites shared one DB/Redis) | done | P1 | 2026-09-18 | 2026-09-18 | loop/work/BUG-006-parallel-suite-interference/ | — |
| FEAT-011 | Resident UI redesign — themeable design system, motion layer, skeletons | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/FEAT-011-resident-ui-redesign/ | ADR-0021 |
| CHORE-008 | Every remaining screen on the design system + shared screen primitives | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/CHORE-008-admin-ui-and-shared-primitives/ | ADR-0022 |
| BUG-007 | A primitive's base class and a caller's className silently fight (13 dead overrides) | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/BUG-007-primitive-class-conflicts/ | ADR-0022 |
| CHORE-009 | Design-parity pass — every screen vs its artboard, in a browser | done | P1 | 2026-09-19 | 2026-09-19 | loop/work/CHORE-009-design-parity-pass/ | ADR-0021, ADR-0022 |
| BUG-008 | A server hiccup signs the resident out (network error treated as a rejected refresh) | done | P1 | 2026-09-19 | 2026-09-19 | loop/work/BUG-008-network-error-logs-you-out/ | — |
| BUG-009 | Profile showed "—" for society: the sign-in response carries none and the store never learned | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/BUG-009-profile-shows-no-society/ | ADR-0015 |
| BUG-010 | A resident sees `currentPrice` on a delivered round, not the negotiated `finalPrice` (needs backend) | done | P1 | 2026-09-19 | 2026-10-17 | loop/work/BUG-010-delivered-round-shows-wrong-price/ | — |
| CHORE-010 | "Unlocks ₹900 at 4 flats" when ₹900 is already the price — nextTier reads as an unlock that changes nothing | done | P3 | 2026-09-19 | 2026-10-17 | loop/work/CHORE-010-next-tier-reads-as-no-change/ | — |
| CHORE-011 | Dev catalog is full of E2E leftovers ("E2E Service 011682", ₹999/unit) — clean before any demo | done | P3 | 2026-09-19 | 2026-10-17 | loop/work/CHORE-011-dev-catalog-e2e-leftovers/ | — |
| CHORE-012 | The BUG-007 class-conflict scan does not police letter-spacing (two Input callers exposed) | done | P2 | 2026-09-19 | 2026-10-17 | loop/work/CHORE-012-letter-spacing-not-policed/ | ADR-0022 |
| CHORE-013 | act() warnings in the web suite hide the next real one | done | P3 | 2026-09-19 | 2026-10-17 | loop/work/CHORE-013-act-warnings-in-profile-tests/ | — |
| BUG-001 | Round mutations 500 when queued > 5s behind the row lock (Prisma tx timeout) | done | P1 | 2026-09-17 | 2026-09-17 | loop/work/BUG-001-round-tx-timeout-under-lock-wait/ | ADR-0004 |
| BUG-002 | Web tests time out under CPU contention (parallel workspaces, tight timeouts) | done | P2 | 2026-09-17 | 2026-09-17 | loop/work/BUG-002-web-tests-timeout-under-load/ | — |
| BUG-003 | API sends no CORS headers — every browser call from the web PWA is blocked | done | P1 | 2026-09-17 | 2026-09-18 | loop/work/BUG-003-backend-cors-not-enabled/ | ADR-0014 |
| FEAT-012 | Admin sign-in is its own page, and asks only for a phone number | done | P1 | 2026-09-19 | 2026-09-19 | loop/work/FEAT-012-admin-sign-in-by-phone/ | ADR-0023 |
| FEAT-013 | One OTP, then signed in for good — sessions no longer expire | done | P1 | 2026-09-19 | 2026-09-19 | loop/work/FEAT-013-lifetime-sessions/ | ADR-0024 |
| CHORE-014 | Input boxes read as gaps — a white border on a white sheet | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/FEAT-012-admin-sign-in-by-phone/ | ADR-0022 |
| CHORE-015 | Admin sign-in drives an unindexed scan on `phone` (unauthenticated); needs a migration | done | P2 | 2026-09-19 | 2026-10-17 | loop/work/CHORE-015-phone-lookup-unindexed/ | ADR-0023 |
| CHORE-016 | An admin's sign-in can be denied by six unauthenticated OTP requests | done | P2 | 2026-09-19 | 2026-10-17 | loop/work/CHORE-016-admin-otp-denial/ | ADR-0023, ADR-0027 |
| CHORE-017 | The OTP send still runs in the request process — the root cause behind three rounds of leaks | done | P2 | 2026-09-19 | 2026-10-17 | loop/work/CHORE-017-otp-send-on-the-queue/ | ADR-0023, ADR-0013, ADR-0027 |
| CHORE-018 | Demo seed — residents, vendors, and a round in every lifecycle state | done | P2 | 2026-10-17 | 2026-10-17 | loop/work/CHORE-018-demo-seed/ | ADR-0010, ADR-0012 |
| CHORE-019 | Demo seed mirrors scheduler constants by hand; base seed has no local-DB guard | done | P3 | 2026-10-17 | 2026-10-17 | loop/work/CHORE-019-demo-seed-drift/ | — |
| FEAT-014 | Admin services page, closed category list, wider catalog, bulk-staples pilot | done | P1 | 2026-10-17 | 2026-10-17 | loop/work/FEAT-014-admin-services-and-categories/ | ADR-0009, ADR-0019, ADR-0025 |
| CHORE-020 | FEAT-014 review leftovers: offline notice hides with panel, price input remount, leak guard untested | done | P3 | 2026-10-17 | 2026-10-17 | loop/work/CHORE-020-services-page-followups/ | — |
| FEAT-015 | Server-side filters on every list; URL filter state; modern filtering UI with micro-interactions | done | P1 | 2026-10-17 | 2026-10-17 | loop/work/FEAT-015-server-filters-and-motion/ | ADR-0021, ADR-0022, ADR-0026 |
| BUG-011 | One component that throws blanks the whole app — there is no error boundary | done | P1 | 2026-10-17 | 2026-10-17 | loop/work/BUG-011-no-error-boundary/ | — |
| CHORE-021 | Node v24.6.0 segfaults inside V8's GC during the backend suite (1 run in 4) | done | P2 | 2026-10-17 | 2026-10-17 | loop/work/CHORE-021-node-v8-gc-segfault/ | — |
| CHORE-022 | An admin's sign-in rests on a 6-digit code reachable through two doors (~30%/yr sustained-attack residual) | triaged | P2 | 2026-10-17 | — | loop/work/CHORE-022-admin-otp-strength/ | ADR-0027 |
| FEAT-016 | Premium phone-app feel: dark mode with a Telegram-style switch, sheets, native chrome | done | P1 | 2026-10-18 | — | loop/work/FEAT-016-native-feel-dark-mode-sheets/ | ADR-0021, ADR-0022, ADR-0028 |
| FEAT-017 | Vercel-style "Mono" look in day and night — flat hairline surfaces, Geist, tight radii | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/FEAT-017-mono-look/ | ADR-0021, ADR-0028, ADR-0029 |
| FEAT-018 | Group buys that feel alive: price ladder, live countdown, invite neighbours, celebrate | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/FEAT-018-rounds-that-feel-alive/ | ADR-0021, ADR-0022, ADR-0030 |
| FEAT-019 | One Vercel look, seven colour combinations, micro-interactions that spark | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/FEAT-019-vercel-accents-and-sparks/ | ADR-0029, ADR-0031 |
| FEAT-020 | Web push notifications on the outbox + BullMQ pipeline: per-event custom messages, theme-aware, scalable fan-out | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/FEAT-020-web-push-notifications/ | ADR-0013, ADR-0015 |
| BUG-012 | check-css-classes pairs quotes across a whole file — an apostrophe in a comment silently hides class lists from the gate | done | P2 | 2026-10-19 | 2026-10-19 | (see LOG) | ADR-0021 |
| FEAT-021 | From a service to booking it in one tap: open-round status on service cards, deep link that opens the pledge sheet | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/FEAT-021-services-to-booking/ | ADR-0010 |
| BUG-013 | admin-auth integration test reads the latest OTP to ANY phone — leftover queued admin-door jobs from earlier suites hand it the wrong code (flaky, ~1 in 10 full runs) | done | P2 | 2026-10-19 | 2026-10-19 | (fix in test helpers; see LOG) | ADR-0027 |
| FEAT-022 | "Ask for this service": residents ask, admin sees demand, an opened round notifies the askers | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/FEAT-022-ask-for-this-service/ | ADR-0033 |
| BUG-014 | Intermittent route-level 404 in backend integration tests under verify.sh (auth OTP request, admin OTP verify) — ~2 in 12 gate runs | triaged | P2 | 2026-10-19 | — | (probe in test/helpers/test-app.ts) | — |
| BUG-015 | Phone view: the ask control squeezed into the service row's text column (one word a line); also /my-requests 12px past a 360px screen and service-row text crushed by the price | done | P1 | 2026-10-19 | 2026-10-19 | (see LOG) | — |
| BUG-016 | Platform consistency at phone width: misaligned values in fact/stat tiles, uneven card padding and icon sizes, cramped 2-up service tiles, orphan arrows, admin nav eating 300px | done | P1 | 2026-10-19 | 2026-10-19 | (see LOG) | ADR-0021, ADR-0022 |
| CHORE-023 | Class gate: check the fixed parts of template literals with `${}` (e.g. Celebrate pieces) — today such lists are skipped whole | triaged | P3 | 2026-10-19 | — | (folder at start) | — |

> Build order (dependency-driven): CHORE-001 → FEAT-001 → FEAT-002 → FEAT-003 →
> FEAT-004 → FEAT-005 → (FEAT-006 cross-cuts, needed by FEAT-001 OTP) → FEAT-007 →
> FEAT-008. FEAT-006's SMS-OTP piece is pulled forward into FEAT-001 (OTP auth needs it).

## Priority scale

- **P0** — broken production / data loss; drop everything
- **P1** — needed for the next release
- **P2** — important, not urgent
- **P3** — nice to have; revisit quarterly
| BUG-017 | Signing in on a second device ends the first device's lifetime session — the rotation handle is one key per resident, not per session | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/BUG-017-second-device-ends-first-session/ | ADR-0024 |
| FEAT-023 | Home leads with Group buys: the accent surface carries live open-round counts and up to three rounds deep-linking into the pledge sheet | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/FEAT-023-home-leads-with-group-buys/ | ADR-0021, ADR-0022 |
| CHORE-024 | Profile: the "This app" card is cluttered; one clean settings list with one row shape | done | P2 | 2026-10-19 | — | loop/work/CHORE-024-profile-clean-up/ | ADR-0021 |
| BUG-018 | Flaky: OTP "awaited dispatch" test races a fixed 50ms sleep against Redis under the full suite (1 in ~5 gate runs) | done | P2 | 2026-10-19 | 2026-10-19 | loop/work/BUG-018-flaky-otp-awaited-dispatch-test/ | — |
| FEAT-024 | Confirm before destructive actions: log out, leave a round, delete a rating, withdraw an ask, admin cancel/deactivate — one confirm sheet | done | P1 | 2026-10-19 | 2026-10-19 | loop/work/FEAT-024-confirm-destructive-actions/ | ADR-0022 |
| FEAT-025 | Server-side pagination on the list endpoints and the screens that read them | done | P1 | 2026-10-19 | 2026-10-20 | loop/work/FEAT-025-server-side-pagination/ | ADR-0005 |
| BUG-019 | Phone stored exactly as typed — `9999900201` and `+919999900201` become two residents (no canonical form) | done | P2 | 2026-10-19 | 2026-10-20 | loop/work/BUG-019-phone-not-normalised/ | ADR-0007, ADR-0036 |
| FEAT-026 | Dev mode: the OTP arrives as a toast at the top (dev-only route + dev-only bundle path; amends ADR-0020) | done | P2 | 2026-10-20 | 2026-10-20 | loop/work/FEAT-026-dev-otp-toast/ | ADR-0020, ADR-0037 |
| FEAT-028 | Product website `apps/site`: Astro, one page, the app's own tokens pinned by test, a 3D society that lights up as neighbours join | in-progress | P1 | 2026-10-20 | — | loop/work/FEAT-027-product-website/ | ADR-0038, ADR-0029, ADR-0031 |
| BUG-020 | `dev-otp.integration.spec.ts` fails 1 run in N: unhandled "Connection is closed" from a BullMQ worker at app teardown (found by FEAT-028 V3; shared-Redis/teardown-race family of BUG-006/013/018) | triaged | P2 | 2026-10-20 | — | loop/work/BUG-020-dev-otp-spec-redis-closed-at-teardown/ | ADR-0013 |
| FEAT-027 | Sign in with WhatsApp ("Tap to verify"): the user messages the business number, we reply with a number-match prompt, the browser polls for the same JWTs — ₹0 per login, SMS OTP stays the fallback | done | P1 | 2026-10-20 | 2026-10-20 | loop/work/FEAT-027-whatsapp-tap-to-verify/ | ADR-0007, ADR-0023, ADR-0038 |
