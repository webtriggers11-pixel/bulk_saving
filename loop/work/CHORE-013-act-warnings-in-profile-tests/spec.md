# CHORE-013 — act() warnings in the web suite hide the next real one

**Status:** done (closed 2026-10-17) · **Priority:** P3 · **Opened:** 2026-09-19 · **Found by:** V2 round 2 of CHORE-009

Every `pnpm --filter web test` run prints repeated
`An update to ProfilePage inside a test was not wrapped in act(...)`. Pre-existing, unrelated
to any current item, and harmless — until it is not: a suite that always prints warnings is a
suite where nobody reads the warnings, and the next real one arrives into that noise.

Fix: find the unwrapped update in the ProfilePage tests (likely the install-prompt or
online-status hook settling after render), wrap it, and get the run quiet.
