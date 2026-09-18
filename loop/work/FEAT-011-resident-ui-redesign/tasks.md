# Tasks FEAT-011 — Resident UI redesign

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes (lint → typecheck →
build → tests). After each: commit and append to LOG.md.

- [x] T1: Token layer — `styles/theme.css` (colour, surface, radius, elevation, blur, spacing,
      motion; 3 palettes on `[data-theme]`), tailwind `theme.extend` mapping, webfont link,
      reduced-motion guard. Test: palette swap changes variables, not classes.
- [x] T2: UI primitives on tokens — Button (primary/secondary/outline/ghost/link + icon size),
      Card, Input, Label, Badge, Toast. — depends: T1
- [x] T3: `components/ui/icon.tsx` — one stroke family, replaces the 🛠️ emoji and the ad-hoc
      BottomNav paths. — depends: T1
- [x] T4: `components/ui/skeleton.tsx` + per-screen skeletons (Home, Services, Rounds,
      MyRequests) mirroring each real layout; `aria-busy` + visually-hidden "Loading …".
      — depends: T2
- [x] T5: Shell — AppShell ground (mesh + grain), glass BottomNav, OfflineBanner, UpdatePrompt.
      — depends: T2, T3
- [x] T6: Onboarding — hero + frosted bottom sheet, step bars, OTP field. — depends: T2
- [x] T7: Home — bento grid (identity, accent CTA, society, group buys). — depends: T3, T5
- [x] T8: Services — hero card + tiles + wide row. — depends: T3, T4
- [x] T9: Group buys — hero with progress ring + count-up, stepper tray, tier spark.
      — depends: T3, T4
- [x] T10: My Requests — status timeline + journey track; RateRound + StarRating restyle.
      — depends: T3, T4
- [x] T11: Feedback states — QueryErrorState, empty cards, inline pledge notices, Profile.
      — depends: T2
- [x] T12: AC tests — theme swap (AC3), reduced motion (AC5), touch targets (AC6), and a
      contrast check of the token pairs (AC7). — depends: T7–T11
- [x] T13: V2 — independent code-reviewer subagent runs the gate ITSELF and reviews the diff
      vs spec + ADR-0021. — depends: T12
- [ ] T14: V3 — fresh full gate, then the suite a SECOND time back-to-back; both logged.
      — depends: T13
