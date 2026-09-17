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
| FEAT-005 | Super-admin dashboard — demand, assign vendor, mark delivered/paid | in-progress | P1 | 2026-09-16 | — | loop/work/FEAT-005-super-admin-dashboard/ | ADR-0003, ADR-0011, ADR-0012 |
| FEAT-006 | Notifications — SMS-first (OTP + round alerts) | triaged | P1 | 2026-09-16 | — | pending | — |
| FEAT-007 | Post-service rating | triaged | P2 | 2026-09-16 | — | pending | — |
| FEAT-008 | PWA shell — installable + offline-friendly | triaged | P2 | 2026-09-16 | — | pending | — |
| BUG-001 | Round mutations 500 when queued > 5s behind the row lock (Prisma tx timeout) | in-review | P1 | 2026-09-17 | — | loop/work/BUG-001-round-tx-timeout-under-lock-wait/ | ADR-0004 |
| BUG-002 | Web tests time out under CPU contention (parallel workspaces, tight timeouts) | in-review | P2 | 2026-09-17 | — | loop/work/BUG-002-web-tests-timeout-under-load/ | — |

> Build order (dependency-driven): CHORE-001 → FEAT-001 → FEAT-002 → FEAT-003 →
> FEAT-004 → FEAT-005 → (FEAT-006 cross-cuts, needed by FEAT-001 OTP) → FEAT-007 →
> FEAT-008. FEAT-006's SMS-OTP piece is pulled forward into FEAT-001 (OTP auth needs it).

## Priority scale

- **P0** — broken production / data loss; drop everything
- **P1** — needed for the next release
- **P2** — important, not urgent
- **P3** — nice to have; revisit quarterly
