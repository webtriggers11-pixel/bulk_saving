# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-19
- **Goal:** Redesign the whole product on the approved design, then make it *properly
  work* — frontend only, no SMS, font provisional.
- **Result:** **FEAT-011, CHORE-008, BUG-007, BUG-008, BUG-009 and CHORE-009 closed.**
  Every screen in the product — six resident, four admin — is on one token layer, and
  every one of them has now been opened in a browser against the real API and had its
  controls driven. Six items remain open, all triaged, none blocking.

## Where the system lives

| | |
|---|---|
| Written system | `DESIGN-SYSTEM.md` (root) |
| Tokens, palettes, surfaces, motion | `apps/web/src/styles/theme.css` |
| Primitives (incl. the eight screen primitives) | `apps/web/src/components/ui/` |
| The canvas — one canvas, 18 boards, all 10 screens | `loop/work/FEAT-011-resident-ui-redesign/design/` · https://claude.ai/artifact/BbGhsSzNC47hds97Bg5gLe |
| What the browser showed, screen by screen | `loop/work/CHORE-009-design-parity-pass/findings.md` |
| Decisions | ADR-0021 (tokens + themes), ADR-0022 (screen primitives) |

## What this session is actually about

**Five defects shipped past a green suite, and every one was invisible to it for the
same reason: a test that reads source or config cannot verify a rendered style.**

| | What did nothing | Found by |
|---|---|---|
| FEAT-011 | `fill-*` collided with a Tailwind namespace | opening the app |
| FEAT-011 | 11 off-scale alpha steps | review |
| CHORE-008 | `Card` padding passed as a className | review |
| BUG-007 | 35 overrides on `CardTitle` / `Input` / `Skeleton` | the test written to find them |
| CHORE-009 | Profile's society, full-bleed strips, logout on a server hiccup | a browser |

Four guards now exist, **and three of them shipped broken first** — twice with the
identical bug (destructuring capture group 1 instead of group 2, so the scan inspected
nothing and reported success):

1. `scripts/check-css-classes.mjs` — gate step after build; every class must resolve to
   a rule in the BUILT stylesheet. Fails below an inspected-count floor.
2. `class-conflicts.test.tsx` — renders every primitive, reads the classes it really
   produces, fails if a caller passes one in the same CSS-property family. **Does not yet
   police letter-spacing — that is CHORE-012, and two fields already rely on luck.**
3. `primitives.test.tsx` — one owner per shape; `features → components/ui|lib`, never the
   reverse.
4. Opening the app. It found the first defect and the last three.

**If you add a fifth guard, give it a floor, and mutate it before trusting it.**

## Verification contract

`bash scripts/verify.sh` — shared types → prisma → lint → typecheck → build →
**css classes** → tests. Dev infra (`docker compose up -d`) must be up.

## What needs the owner

1. **BUG-010 (P1) — a resident is shown the wrong money.** The admin negotiated ₹700;
   the resident's delivered card says ₹900, because `RoundDto` has no `finalPrice`.
   Needs a shared DTO field + mapper, so it is backend work and was left alone.
2. **No SMS provider** — still the one thing that makes the product unusable in
   production rather than merely unhardened. DEPLOY.md §0. Out of scope by instruction.
3. **The webfont** stays a CDN link; the owner has said the font is provisional.
4. **CHORE-010** — "Unlocks ₹900 at 4 flats" when ₹900 is already the price. Needs a
   decision about what the first tier *means* before either the copy or the API is right.

## Open, triaged, not blocking

CHORE-006 (no admin services page) · **BUG-010 (P1, above)** · CHORE-010 · CHORE-011
(dev catalog full of E2E leftovers — clean before any demo) · CHORE-012 (letter-spacing
unpoliced) · CHORE-013 (act() warnings).

## Environment notes that cost time

- Ports 5173–5175 are taken by another project on this machine; the dev server lands on
  5199 and the API must then be started with `CORS_ORIGINS=http://localhost:5199`.
- OTP is 5 per phone per hour. For a browser pass, promote a second seeded resident to
  SUPER_ADMIN rather than burning the admin's quota.
- `/tmp/scenario.mjs` + `/tmp/scenario2.mjs` (this session) drive the public API to
  create a resident holding an open round, a delivered one to rate, and one nobody
  joined — every state the screens draw.
