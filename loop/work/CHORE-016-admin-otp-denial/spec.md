# CHORE-016 — spec

The problem statement and the options are in `report.md` (written when this was triaged).
Decision and acceptance live in **ADR-0027**. Acceptance, as built:

- A single client cannot spend an owner's OTP request budget (per (scope, phone, client)).
- A per-phone ceiling caps what rotating clients can buy (10 requests/hour per scope).
- Failed guesses are budgeted per phone across BOTH doors: 10 per client, 20 per phone,
  per hour; a spent budget refuses even a correct code.
- Identical for every caller on both doors; `TRUST_PROXY` makes the client real behind a proxy.
