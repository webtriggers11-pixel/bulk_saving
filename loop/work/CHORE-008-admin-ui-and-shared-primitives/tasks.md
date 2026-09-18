# Tasks CHORE-008

Check a box only when `bash scripts/verify.sh` passes. Commit + LOG after each.

- [x] T1: `PageHeader`, `EmptyState`, `FactTile`, `Monogram`, `AmbientGround` + tests.
- [x] T2: `StatCard`, `Field`, `DataRows` + tests. — depends: T1
- [ ] T3: resident screens refactored onto the primitives (no visual change). — depends: T2
- [ ] T4: admin artboards added to the stored canvas. — depends: T2
- [ ] T5: `AdminLayout` + `StatusBadge` on the system. — depends: T2
- [ ] T6: admin dashboard. — depends: T5, T4
- [ ] T7: admin new round + vendors. — depends: T5, T4
- [ ] T8: admin round detail. — depends: T5, T4
- [ ] T9: browser pass — signed in as super-admin against the real API. — depends: T6–T8
- [ ] T10: V2 — independent reviewer runs the gate itself. — depends: T9
- [ ] T11: V3 — two back-to-back runs, both logged. — depends: T10
