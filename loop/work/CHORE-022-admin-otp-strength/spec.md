# CHORE-022 — An administrator's sign-in rests on a 6-digit code reachable through two doors

**Status:** triaged · **Priority:** P2 · **Opened:** 2026-10-17 · **Found by:** CHORE-016/017 V2 round 3

After ADR-0027 a multi-address attacker gets at most 40 guesses an hour at a SUPER_ADMIN
(20 per door × the admin door and their society's door) — ≈2.9% a month, ≈30% a year if
sustained. Better than before (50/hour), and honest in the ADR, but the only revisit
trigger is a support report: nothing alerts on a sustained guessing attempt.

Options — needs the owner's decision (it changes the admin sign-in experience):
1. 8-digit codes for the admin door (100× the guess space; 40/hour → ≈0.35%/year).
2. A second factor for SUPER_ADMIN (TOTP app), the code staying as the first.
3. Alerting: emit a metric/log on every budget LOCKED for a SUPER_ADMIN phone.

Recommendation: 1 now (smallest change, no new UX beyond two digits), 3 alongside.
