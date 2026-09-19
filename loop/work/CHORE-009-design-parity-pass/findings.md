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

1. **Profile showed "—" for Society** (now tracked as BUG-009). `POST /auth/otp/verify`
   returns tokens and a resident and no society, so the store held `null`; Profile reads the
   store on purpose (ADR-0015 — it is the screen that must work offline). Fixed by teaching
   the store from the `me` query (`useSessionSync`).

   Two corrections to what this originally claimed, both from V2:
   - It is **not** free. `AppShell` is instantiated per route, so the sync would have added a
     `me` request on four screens that never had one. It now asks **only while the society is
     unknown**, so the normal case costs nothing and a deep link to `/profile` still fills in.
   - It must not write a society it cannot **prove** belongs to the signed-in resident: a
     cached `me` from the previous resident on a shared phone is the exact scenario ADR-0015
     exists for, and this store is persisted, so the mistake would outlive the cache. The
     write is now guarded on resident id, and the forced-logout path clears the query cache
     the way the two explicit logouts already did.
2. **The offline and update strips ran edge to edge** while every screen is a centred
   `max-w-md` column, so on anything wider than a phone their text started far left of the
   content. Now the same column.
3. **A server hiccup signed the resident out** — see BUG-008. The first fix only closed the
   rarer half: it keyed on "did the body parse as JSON", so a 500 from a Redis blip and a 429
   from the global throttler still ended the session, while a 502 that happened to render HTML
   kept it. Session lifetime cannot depend on the content type of an error page. It now keys
   on the status: **401/403 clears, everything else keeps**. Triaged separately because it
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
| Profile hero name now carries the same tracking as Home's | V2 caught the two hero names at different letter-spacings: arbitrary sizes bring no tracking, so whichever caller remembered it won. Tracking now lives in the size token. |

## Recorded, NOT fixed — and now tracked in the registry, not just here

BUG-010 (P1), CHORE-010 and CHORE-011. V2's point stands: a finding that lives only in a
findings file is untracked work, and the first of these is a resident being shown the wrong
amount of money.

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
