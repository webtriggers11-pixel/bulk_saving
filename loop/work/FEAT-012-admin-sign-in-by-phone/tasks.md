# Tasks FEAT-012 — Admin sign-in by phone

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.

- [x] T1: shared contracts + `NOT_AN_ADMIN` error code
- [x] T2: `ResidentsService.findSuperAdminByPhone` + unit tests (zero / one / ambiguous) — depends: T1
- [x] T3: admin request + verify endpoints, DTOs, controller wiring — depends: T2
- [x] T4: backend tests — AC1–AC6, AC10 — depends: T3
- [ ] T5: `AdminLoginPage` + route + `AdminRoute` redirect + api functions — depends: T1
- [ ] T6: web tests — AC7, AC8, AC9 — depends: T5
- [ ] T7: drive it in a real browser against the real API, both roles — depends: T4, T6
- [ ] T8: V2 — independent code-reviewer subagent runs the gate itself — depends: T7
- [ ] T9: V3 — two back-to-back gate runs, then close — depends: T8
