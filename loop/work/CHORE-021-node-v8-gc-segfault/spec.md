# CHORE-021 — Node v24.6.0 segfaults in V8's garbage collector during the backend suite

**Status:** done (closed 2026-10-17) · **Priority:** P2 · **Opened:** 2026-10-17 · **Found by:** FEAT-015 / BUG-011 gate runs

One gate run of four died with `Segmentation fault: 11` two suites into `jest --runInBand`.
The macOS crash report (`~/Library/Logs/DiagnosticReports/node-2026-10-17-204347.ips`) has
`EXC_BAD_ACCESS` in `v8::internal::ClearStaleLeftTrimmedPointerVisitor::VisitRootPointers`
under `MarkCompactCollector::MarkRoots` — a crash inside V8's own mark-compact GC, not in
any test or application code. The other three runs, same code, passed in full.

Not a flaky TEST (no assertion differed), but it does make the gate non-deterministic, which
V3 exists to forbid. Fix when taken: move the dev machine and the Dockerfile's base image to
the latest Node 24 patch release and confirm 5 consecutive clean gate runs. Changing the
machine's Node is the owner's call (it is shared with other projects).

## Resolution (2026-10-17)

- The repo pins Node **24.22.0** in `.nvmrc` (latest 24 LTS). The Docker images already
  build from the floating `node:24-alpine`, so they pick up patch releases on rebuild.
- Installed 24.22.0 on the dev machine with nvm, and **kept the machine's default at
  24.6.0** (the nvm default followed "newest installed" and briefly moved; restored),
  because other projects share it. `nvm use` in this repo selects 24.22.0.
- Three back-to-back full gate runs on 24.22.0: exit 0, identical (backend 396/396, web
  382/382), no segfault. Switching the machine default is the owner's call.
