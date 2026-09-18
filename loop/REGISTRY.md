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
| CHORE-002 | Dev-only: surface the OTP in a toast (gated, never in production) | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-002-dev-otp-toast/ | ADR-0016 |
| CHORE-003 | Live end-to-end smoke harness (scripts/e2e-smoke.mjs) | done | P2 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-003-e2e-smoke-harness/ | — |
| CHORE-004 | verify.sh must also run the build (a broken build stayed green) | done | P1 | 2026-09-18 | 2026-09-18 | loop/work/CHORE-004-verify-build-gate/ | — |
| FEAT-009 | Rating UI — resident rates from My Requests; admin sees averages | in-progress | P2 | 2026-09-18 | — | loop/work/FEAT-009-rating-ui/ | ADR-0018 |
| BUG-004 | Offline: admin controls hang on "Saving…" forever (v5 pauses, never fails) | in-progress | P2 | 2026-09-18 | — | loop/work/BUG-004-offline-paused-admin-controls/ | — |
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
