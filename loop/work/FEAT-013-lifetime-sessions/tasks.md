# Tasks FEAT-013 — Lifetime sessions

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.

- [x] T1: nullable refresh lifetime in `AuthService` — sign, issue, and the rotation Lua
- [x] T2: env var wiring + validation — depends: T1
- [x] T3: tests — AC1–AC7, including the rotated-handle TTL and the years-old token — depends: T2
- [ ] T4: V2 — independent code-reviewer subagent — depends: T3
- [ ] T5: V3 — two back-to-back gate runs, then close — depends: T4
