# Tasks FEAT-008 — PWA shell

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-008): ...`) AND append a LOG.md entry.

- [x] T1: Vitest can resolve `virtual:pwa-register/react` — stub module + alias in `apps/web/vite.config.ts`, with a test proving the stub loads. (De-risks T7 first.)
- [x] T2: `useOnlineStatus` hook + tests (initial state, `offline`/`online` events, listener cleanup). — depends: T1
- [x] T3: `OfflineBanner` + tests (renders only while offline, disappears on reconnect, has an accessible role). — depends: T2
- [x] T4: `BottomNav` — four BRIEF tabs, `aria-current="page"` on the active one, 44 px targets; tests for labels, hrefs and active marking. — depends: T1
- [x] T5: `AppShell` wraps resident routes with nav + banner + safe-area padding; `App.tsx` leaves `/onboard` and `/admin/*` outside it. Tests for AC1 + AC2. — depends: T3, T4
- [x] T6: `useInstallPrompt` + `ProfilePage` at `/profile`: phone / society / role, Log out → session cleared → `/onboard`, install control shown only when the event fired (iOS hint otherwise). Tests for AC4 + AC5. — depends: T5
- [x] T7: `UpdatePrompt` via `useRegisterSW`, mounted in `AppShell`; test that a waiting worker shows the prompt and Reload calls `updateServiceWorker(true)`. — depends: T1, T5
- [x] T8: `QueryState` offline/retry component adopted by the resident data pages (Home, Services, Rounds) so a failed refetch shows offline + Retry and keeps already-cached data. Tests for AC7. — depends: T3
- [x] T8b: `/my-requests` page on `GET /rounds/mine` (joined rounds, any status), tab repointed from `/rounds`; tests for AC1b. — depends: T5, T8
- [x] T9: AC3 + AC8 evidence — `pnpm --filter web build`, assert the precache manifest covers the shell entries and `navigateFallback` is present; check no horizontal scroll at 360 px by inspection of the layout classes. Record findings in the work folder. — depends: T5, T6, T7, T8
- [x] T10: V2 — independent code-reviewer subagent runs `verify.sh` itself and reviews the diff vs spec + ADR-0015. — depends: T9
- [x] T10b: V2 fixes — P1-1 install capture at module scope, P1-2 paused-query gating on all four pages (+ AC7b paused mutations), P1-3 real cleanup assertion, P1-4 registry/process, P1-5 + P2-5 ADR confidence and supersession via ADR-0016, P2-1..P2-8. — depends: T10
- [x] T11: V3 — fresh double run of `verify.sh` back-to-back, both logged; REGISTRY → done; LOG close entry. — depends: T10
