# BUG-009 — Profile shows "—" where the design shows the society

**Status:** done · **Priority:** P2 · **Opened / closed:** 2026-09-19 · **Found by:** CHORE-009's browser pass

`POST /auth/otp/verify` returns tokens and a resident and **no society**, so `login()` stored
`society: null`. The Profile tab reads the store rather than the network on purpose — it is
the one screen that must work offline (ADR-0015) — so every resident who signed in saw a dash
where the design shows their society's name. Home masked it by rendering from `GET /me`.

**Fix:** `useSessionSync` teaches the store from the `me` query, guarded so it writes only a
society it can prove belongs to the signed-in resident, and enabled only while the society is
unknown — so it adds no request once it is. Fixed inside CHORE-009; kept as its own row
because it is a defect, not a style gap (CLAUDE.md rule 1).
