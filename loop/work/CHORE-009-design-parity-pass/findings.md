# CHORE-009 — what the browser showed, screen by screen

Every resident screen and state was opened against the real API, with data created for the
purpose (a resident with an OPEN round, a DELIVERED one to rate, and a round nobody joined).
Sizes and radii were read from computed style, not eyeballed.

## Matches the artboard, measured

| Screen | Checked |
|---|---|
| Home | card radius 24px, card padding 22px, glass blur 26/saturate 1.8, name 24px/800/-0.042em, eyebrow 10.5px/0.14em brand-ink, grid gap 14px, screen padding 22px |
| Services | hero with watermark glyph + price pill, two tiles, wide rows below, scope line per card |
| Group buys | joined card (stepper + Leave) and not-joined card (units input + Join), tier ring, tier line, scope block |
| My Requests | status rail with per-status dot colour, 4-stop journey track (1/4 Open, 4/4 Delivered), fact tiles, inline rating form on the delivered round |
| Profile | monogram with halo, name 25px, role badge, Phone/Society tiles, install card, connection pill |
| Onboarding | hero wordmark 48px gradient, step bars (active one wider), frosted sheet, code field 21px |
| States | skeleton (hero + two tiles + row, matching the real geometry), empty (glyph + CTA), failed read (icon + message + Retry), offline strip, `Joining…` pending button |

## Fixed in this pass

1. **Profile showed "—" for Society.** `POST /auth/otp/verify` returns tokens and a resident
   and no society, so the store held `null`; Profile reads the store on purpose (ADR-0015 —
   it is the screen that must work offline). Fixed by teaching the store from the `me` query
   (`useSessionSync`, same query key as Home, so no extra request).
2. **The offline and update strips ran edge to edge** while every screen is a centred
   `max-w-md` column, so on anything wider than a phone their text started far left of the
   content. Now the same column.
3. **A server hiccup signed the resident out** — see BUG-008. Triaged separately because it
   is an auth behaviour, not a style: a thrown `fetch` was treated like a refusal, so an API
   that is merely unreachable ended the session. Now only a server that *answers and refuses*
   clears it.

## Differences kept, with the reason

| Difference | Why |
|---|---|
| Card radius 24px; artboards draw 26px on glass/accent | One radius for every card is the system (`rounded-card`). Two would be a token nobody could name. |
| Column is 448px (`max-w-md`); artboards are 390px frames | The artboard is a phone frame, not a max width. The app has used `max-w-md` since FEAT-008. |
| No arrow on the services hero card | The artboard draws one; V2 (FEAT-011) removed it because it advertises a tap target that card does not have. |
| Ring shows a lower count for ~1s after load | `useCountUp` — the intro animation, by design (Motion artboard). |

## Recorded, NOT fixed — they need the owner or the backend

1. **A delivered round shows `currentPrice`, not the negotiated `finalPrice`.** The admin
   assigned ₹700; the resident's card says ₹900. `RoundDto` carries no `finalPrice`, so this
   cannot be fixed in the frontend — and it is what a resident believes they owe, so it
   should not be guessed at either.
2. **"Unlocks ₹900 at 4 flats" while the current price is already ₹900.** `nextTier` is the
   first tier not yet *reached*, so before anyone joins, the first tier reads as an unlock
   that changes nothing. Backend semantics; the copy is only as clear as the field.
3. **E2E leftovers are in the catalog** ("E2E Service 011682" and friends, ₹999/unit). Test
   data in the dev database, not a product defect — worth a cleanup task before any demo.

## Interaction pass — every control driven in the browser, against the real API

| Control | Result |
|---|---|
| Group buys — stepper `+` | 2 → 3 rooms; the server accepted it and the refetched card agreed |
| Group buys — Leave | "pledged 1 flat" → not joined, and the units input + Join came back |
| My Requests — rating | 4th star → Submit → saved state renders "4 / 5" with Change and Remove |
| Tab bar | all four tabs route; no tab claims `aria-current` on `/rounds`, which is not a tab |
| Profile — society | now reads "Green Meadows", and it is persisted, so a reload and offline both keep it |
| Admin — status filter | 94 rows → 23, every one of them "Needs vendor"; the `Field` label is linked to the select |
| Admin — add vendor (invalid) | `aria-invalid="true"` + `aria-describedby` pointing at the real message, "Phone must be 8–15 digits, optionally starting with +." |
| Admin — add vendor (valid) | vendor created, list 18 → 19, the new row rendered |
| `/admin` as a resident | redirects to `/` — the guard holds |

The `Field` primitive's aria wiring, which CHORE-008 introduced and V2 asked about, is
confirmed end to end in a real browser rather than only in jsdom.
