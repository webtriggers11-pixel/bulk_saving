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
| CHORE-006 | Admin has no services page — the catalog is API-only | triaged | P2 | 2026-09-18 | — | loop/work/CHORE-006-admin-services-page/ | ADR-0009 |
| BUG-005 | Rare 401 in the admin integration suite — mitigated by BUG-006 | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/BUG-005-flaky-401-admin-suite/ | — |
| CHORE-007 | Production hardening — headers, rate limits, no auth bypass, Docker, CI, runbook | done | P0 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-007-production-hardening/ | ADR-0020 |
| BUG-006 | The backend gate could not pass twice in a row (parallel suites shared one DB/Redis) | done | P1 | 2026-09-18 | 2026-09-18 | loop/work/BUG-006-parallel-suite-interference/ | — |
| FEAT-011 | Resident UI redesign — themeable design system, motion layer, skeletons | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/FEAT-011-resident-ui-redesign/ | ADR-0021 |
| CHORE-008 | Every remaining screen on the design system + shared screen primitives | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/CHORE-008-admin-ui-and-shared-primitives/ | ADR-0022 |
| BUG-007 | A primitive's base class and a caller's className silently fight (13 dead overrides) | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/BUG-007-primitive-class-conflicts/ | ADR-0022 |
| CHORE-009 | Design-parity pass — every screen vs its artboard, in a browser | done | P1 | 2026-09-19 | 2026-09-19 | loop/work/CHORE-009-design-parity-pass/ | ADR-0021, ADR-0022 |
| BUG-008 | A server hiccup signs the resident out (network error treated as a rejected refresh) | done | P1 | 2026-09-19 | 2026-09-19 | loop/work/BUG-008-network-error-logs-you-out/ | — |
| BUG-009 | Profile showed "—" for society: the sign-in response carries none and the store never learned | done | P2 | 2026-09-19 | 2026-09-19 | loop/work/BUG-009-profile-shows-no-society/ | ADR-0015 |
| BUG-010 | A resident sees `currentPrice` on a delivered round, not the negotiated `finalPrice` (needs backend) | triaged | P1 | 2026-09-19 | — | loop/work/BUG-010-delivered-round-shows-wrong-price/ | — |
| CHORE-010 | "Unlocks ₹900 at 4 flats" when ₹900 is already the price — nextTier reads as an unlock that changes nothing | triaged | P3 | 2026-09-19 | — | loop/work/CHORE-010-next-tier-reads-as-no-change/ | — |
| CHORE-011 | Dev catalog is full of E2E leftovers ("E2E Service 011682", ₹999/unit) — clean before any demo | triaged | P3 | 2026-09-19 | — | loop/work/CHORE-011-dev-catalog-e2e-leftovers/ | — |
| CHORE-012 | The BUG-007 class-conflict scan does not police letter-spacing (two Input callers exposed) | triaged | P2 | 2026-09-19 | — | loop/work/CHORE-012-letter-spacing-not-policed/ | ADR-0022 |
| CHORE-013 | act() warnings in the web suite hide the next real one | triaged | P3 | 2026-09-19 | — | loop/work/CHORE-013-act-warnings-in-profile-tests/ | — |
| BUG-001 | Round mutations 500 when queued > 5s behind the row lock (Prisma tx timeout) | done | P1 | 2026-09-17 | 2026-09-17 | loop/work/BUG-001-round-tx-timeout-under-lock-wait/ | ADR-0004 |
| BUG-002 | Web tests time out under CPU contention (parallel workspaces, tight timeouts) | done | P2 | 2026-09-17 | 2026-09-17 | loop/work/BUG-002-web-tests-timeout-under-load/ | — |
| BUG-003 | API sends no CORS headers — every browser call from the web PWA is blocked | done | P1 | 2026-09-17 | 2026-09-18 | loop/work/BUG-003-backend-cors-not-enabled/ | ADR-0014 |

> Build order (dependency-driven): CHORE-001 → FEAT-001 → FEAT-002 → FEAT-003 →
> FEAT-004 → FEAT-005 → (FEAT-006 cross-cuts, needed by FEAT-001 OTP) → FEAT-007 →
> FEAT-008. FEAT-006's SMS-OTP piece is pulled forward into FEAT-001 (OTP auth needs it).

## Priority scale

- **P0** — broken production / data loss; drop everything
- **P1** — needed for the next release
- **P2** — important, not urgent
- **P3** — nice to have; revisit quarterly
