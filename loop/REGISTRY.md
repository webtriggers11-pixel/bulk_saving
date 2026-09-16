# WORK REGISTRY — every work item, tagged and tracked

> Single index of all features, bugs, and chores. The `triage` skill assigns
> IDs and adds rows; skills update Status as work moves. Never delete rows —
> this table is the project's history at a glance.

**ID format:** `FEAT-NNN` (feature) · `BUG-NNN` (bug) · `CHORE-NNN` (refactor/tooling/docs)
**Status flow:** `triaged → specced → planned → in-progress → in-review → done` (bugs: `triaged → reproduced → in-progress → in-review → done`)

| ID | Title | Status | Priority | Opened | Closed | Folder | Decisions |
|----|-------|--------|----------|--------|--------|--------|-----------|
| CHORE-001 | Monorepo scaffold + stack bootstrap (verify.sh, CI) | done | P1 | 2026-09-16 | 2026-09-16 | loop/work/CHORE-001-bootstrap-scaffold/ | ADR-0002, ADR-0005, ADR-0006 |
| FEAT-001 | Society onboarding + phone-OTP auth (multi-tenant foundation) | triaged | P1 | 2026-09-16 | — | pending | ADR-0003 |
| FEAT-002 | Service catalog per society | triaged | P1 | 2026-09-16 | — | pending | — |
| FEAT-003 | Group-buy rounds — join, units, tiers, live counter (core) | triaged | P1 | 2026-09-16 | — | pending | ADR-0004 |
| FEAT-004 | Round lifecycle state machine + scheduled closing (BullMQ) | triaged | P1 | 2026-09-16 | — | pending | — |
| FEAT-005 | Super-admin dashboard — demand, assign vendor, mark delivered/paid | triaged | P1 | 2026-09-16 | — | pending | — |
| FEAT-006 | Notifications — SMS-first (OTP + round alerts) | triaged | P1 | 2026-09-16 | — | pending | — |
| FEAT-007 | Post-service rating | triaged | P2 | 2026-09-16 | — | pending | — |
| FEAT-008 | PWA shell — installable + offline-friendly | triaged | P2 | 2026-09-16 | — | pending | — |

> Build order (dependency-driven): CHORE-001 → FEAT-001 → FEAT-002 → FEAT-003 →
> FEAT-004 → FEAT-005 → (FEAT-006 cross-cuts, needed by FEAT-001 OTP) → FEAT-007 →
> FEAT-008. FEAT-006's SMS-OTP piece is pulled forward into FEAT-001 (OTP auth needs it).

## Priority scale

- **P0** — broken production / data loss; drop everything
- **P1** — needed for the next release
- **P2** — important, not urgent
- **P3** — nice to have; revisit quarterly
