# Tasks FEAT-027 — Sign in with WhatsApp

- [x] T1 ADR-0038 + shared types + error codes + env (all-or-none) + WhatsApp sender module (cloud + stub) + unit tests
- [x] T2 WaLoginService (Redis state machine) + controllers (start/status/methods, webhook GET/POST with raw-body signature) + integration tests (both doors, signed payloads) — depends: T1
- [x] T3 Dev simulator routes under DevToolsModule + `.env.example` + DEPLOY.md — depends: T2
- [x] T4 Web: methods, WhatsApp step on both doors, polling, QR on laptops (`qrcode`), dev panel, bundle guard, tests — depends: T2
- [ ] T5 Browser pass on a DEV server through the simulator (resident + admin + wrong button + expiry) — depends: T3, T4
- [ ] T6 V2 independent review; fixes — depends: T5
- [ ] T7 V3 double run; close; handoff — depends: T6
