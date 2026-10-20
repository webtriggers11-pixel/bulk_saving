# Bulk Saving — Product Features

> Source of truth for the product website and PR material. Every feature below is
> shipped in the app (status from `loop/REGISTRY.md`, 2026-10-20) unless marked
> otherwise. The website in `apps/site` is generated from this list (FEAT-027) and a
> test pins its content to the registry. Each entry gives **what it is**, **how it is used**, and **why it
> exists**, plus the website section it belongs to. Do not claim anything on the
> website that is listed under "Not yet / do not claim".

---

## 1. The product in one line

**Bulk Saving pools a housing society's demand for everyday home services so every
neighbour gets the bulk price, with zero coordination effort.**

- **Who it is for:** residents of urban Indian housing societies (100–400 flats),
  and the founder-operator who runs supply.
- **The problem:** each resident books AC servicing, pest control, deep cleaning,
  painting and similar jobs alone, at full single-customer price (~₹1000 for one AC
  service). Neighbours want the same service in the same season but never coordinate.
- **The economics:** pooled demand removes the vendor's per-job acquisition and
  travel cost, so the discount is real (₹1000 → ~₹700 in the AC example), not a subsidy.
- **The promise:** *"I get everyday home services genuinely cheaper by pooling with my
  neighbours, without having to organise anything myself."*
- **Two sides of the app:** a mobile-first resident PWA (Home · Services · My Requests
  · Profile) and a super-admin web dashboard (Dashboard · Rounds · Services · Vendors
  · Payments · Societies).

---

## 2. Website section map (why these sections)

The website should follow the resident's journey, because the product's value is a
sequence, not a list. Each section answers the question the visitor has at that moment.

| # | Section | Visitor's question | Features that back it |
|---|---------|-------------------|-----------------------|
| 1 | Hero: "Your society, one price" | What is this? | Core mechanic (FEAT-003, 018) |
| 2 | How a group buy works | How do I actually save? | FEAT-003, 004, 010, 018 |
| 3 | Browse, ask, book | What can I get, and how fast? | FEAT-002, 014, 021, 022 |
| 4 | Never miss a round | Will I know when to act? | FEAT-006, 020 |
| 5 | Trust and accountability | Is the vendor any good? | FEAT-007, 009, 005 |
| 6 | Built for a phone in a society | Is it painless to use? | FEAT-001, 008, 012, 013, 016, 023, 024 |
| 7 | A look you want to open | Does it feel premium? | FEAT-011, 015, 017, 019 |
| 8 | For operators (B2B / societies / RWAs) | Can I run this for my society? | FEAT-005, 014, 015, 022, 025 |
| 9 | Pilot: bulk staples | Is it only services? | FEAT-014 scope change |
| 10 | Roadmap and honesty | What is not here yet? | Section 6 of this file |

---

## 3. Features, grouped by website section

All 26 shipped features (FEAT-001 to FEAT-026) appear below.

### Section A — The core mechanic: group-buy rounds

#### FEAT-003 · Group-buy rounds: join, units, tiers, live counter
- **What:** A *round* is a time-boxed group buy for one service in one society. It
  carries a deadline and a price ladder (e.g. 5 units → ₹800, 10 units → ₹700). The
  price everyone pays is the best tier the pooled units have reached.
- **How it is used:** A resident opens Home, sees the open rounds in their society
  with the live unit count, today's price, the next tier and the deadline, and joins
  with one tap, choosing how many units (2 ACs, 3 rooms). They can raise, lower or
  withdraw their pledge while the round is open.
- **Why:** This is the product. Thresholds count **units, not people**, so one flat
  with three ACs moves the group as much as three flats. The shared deadline solves
  "everyone wants it at a different time". Counts are authoritative in Postgres
  through atomic transactions, so two neighbours joining at the same instant can
  never corrupt the price.
- **Website angle:** "6 of 10 joined · closes in 4 days · unlocks ₹700."

#### FEAT-004 · Round lifecycle and scheduled closing
- **What:** Every round moves through an explicit lifecycle:
  OPEN → CLOSED_MET or CLOSED_EXPIRED → ASSIGNED → DELIVERED → RATED (plus CANCELLED).
  A scheduled job closes each round at its deadline automatically.
- **How it is used:** Residents never have to watch the clock. At the deadline the
  round closes itself; if the minimum tier was reached it is "met" and goes to the
  operator for vendor assignment, otherwise it expires and everyone is told.
- **Why:** A group buy only creates urgency if the deadline is real. Automatic
  closing makes the deadline a promise the system keeps, and a single guarded
  state machine means a round can never be in an impossible state.
- **Website angle:** "Deadlines that mean it."

#### FEAT-010 · Per-service unit labels
- **What:** Each service defines what a "unit" is: AC units, rooms, bathrooms,
  cars, 25 kg packs.
- **How it is used:** A resident pledges "2 rooms" for deep cleaning or "3 ACs"
  for servicing; every count on screen speaks the service's own language.
- **Why:** "2 units" is abstract and causes mistakes. Correct nouns make the
  threshold understandable at a glance and the pledge accurate.

#### FEAT-018 · Rounds that feel alive
- **What:** A summary strip (open rounds, rounds I've joined, my best possible
  saving), a visual **price ladder** per round showing every tier and how many
  more units unlock the next price, a live ticking countdown inside the last day,
  one-tap **Invite neighbours** (phone share sheet or copied link), and a
  celebration when a cheaper tier unlocks or you join.
- **How it is used:** A resident sees "3 more ACs to unlock ₹700", taps Invite,
  shares to the society WhatsApp group, and watches the ladder fill.
- **Why:** The mechanic's magic is "the more neighbours join, the cheaper it gets
  for everyone". That must be *seen*, not read in a footnote. Residents are also
  the best recruiters; the share button turns every participant into one. The
  celebration gives joining a moment of delight, which drives repeat use.
- **Website angle:** show the ladder filling; "Bring a neighbour, drop the price."

---

### Section B — Browse, ask, book

#### FEAT-002 · Service catalog per society
- **What:** Each society has its own list of offered services with an indicative
  price, description and scope.
- **How it is used:** Residents browse Services and see only what is available in
  their society.
- **Why:** Multi-tenant from day one: one society's deal never leaks into another's.
  Services are data, not code, so the operator can shape the catalog per society.

#### FEAT-014 · Admin services page, closed categories, wider catalog, bulk-staples pilot
- **What:** Operators add, edit, switch on/off and price services per society from a
  page. Categories are a fixed set (Appliances, Home Care, Renovation, Utilities,
  Vehicle, Bulk Staples). The catalog grew to 23 services with proper icons.
- **How it is used:** The operator turns "water tank cleaning" on for Society A at
  ₹1,200 and leaves it off for Society B. Residents see category glyphs on cards.
- **Why:** A catalog the operator cannot manage is not a product. A closed category
  list stops "Home" and "Home Care" from becoming two groups. Bulk staples (25 kg
  rice, 15 L oil, 10 kg atta, one delivery to the gate) tests whether the same
  pooling mechanic works for goods.
- **Website angle:** category grid; "From AC servicing to 25 kg of rice."

#### FEAT-021 · From a service to booking in one tap
- **What:** A service card shows whether a group buy is open right now (today's
  price, units joined, closes in …). The whole card deep-links straight into that
  round with the pledge sheet already open.
- **How it is used:** Resident opens Services, sees "AC servicing · open · ₹800 ·
  closes in 2 days", taps, picks units, done.
- **Why:** Sessions are ~30 seconds. Every extra screen between intent and pledge
  loses a neighbour. The catalog must never be a dead end.

#### FEAT-022 · "Ask for this service"
- **What:** When no round is open, residents tap **Ask for this** and see how many
  neighbours already asked. The operator's dashboard shows demand per society and
  service, with how long people have waited, and a one-click "Open a round" that
  pre-fills the form. When the round opens, everyone who asked is notified first,
  and the push opens that round's pledge sheet.
- **How it is used:** Four flats ask for pest control in March; the operator sees
  it, negotiates, opens the round, and those four are the first to join.
- **Why:** Demand liquidity is the product's biggest risk (BRIEF R2). Asking turns
  invisible intent into a number the operator can act on, and closes the loop by
  rewarding the askers with first notice.
- **Website angle:** "Don't see it? Ask. Your neighbours probably want it too."

---

### Section C — Never miss a round

#### FEAT-006 · Notifications, SMS-first (OTP and round alerts)
- **What:** Residents receive messages for every event that matters: pledge
  confirmed, closing soon, closed (met, with the unlocked price, or expired),
  vendor assigned, job delivered with a rating ask, round cancelled.
- **How it is used:** Nothing to configure; a resident who joined a round hears
  about it at every step by SMS.
- **Why:** Urgency that reaches nobody is not urgency. Messages are written in the
  same database transaction as the round change (transactional outbox), so a
  message is never sent for something that did not happen and never sent twice.
  SMS first because it reaches every phone in India without an app install.

#### FEAT-020 · Web push notifications
- **What:** Rich push notifications on the installed PWA, worded per event and
  coloured in the resident's chosen accent, that open the right screen when tapped.
  Sent by scalable workers with retry, rate limiting, exact-once delivery and
  automatic pruning of dead devices.
- **How it is used:** Resident turns on notifications from Profile or when joining;
  the phone buzzes "Your AC round just unlocked ₹700".
- **Why:** Installed users deserve the app-like channel, and a burst (200
  participants × 3 devices) must fan out in parallel without double-sends.
- **Website angle:** "Your phone buzzes the moment the price drops."

---

### Section D — Trust and accountability

#### FEAT-005 · Super-admin dashboard: demand, assign vendor, mark delivered and paid
- **What:** One place for the operator to see demand across societies, open, close
  or cancel rounds, assign a vendor with the negotiated final price, mark the job
  delivered, and track payment collection per resident (manual, no gateway).
  Includes a minimal vendor list (name, phone, category, notes, active flag).
- **How it is used:** A round closes "met"; the operator picks the vendor, records
  ₹700/unit, marks delivered after the visit, then ticks each flat as paid.
- **Why:** The founder negotiates offline; the dashboard is where pooled demand
  becomes a real job. Payment stays manual in v1 by design (no Razorpay/UPI).
- **Website angle:** "A human negotiates every deal."

#### FEAT-007 · Post-service rating
- **What:** After delivery, each participating resident rates the job 1–5 with an
  optional comment. One rating per resident per round, correctable.
- **How it is used:** The delivery SMS asks for a rating; the resident taps and rates.
- **Why:** The product's success metric is "delivered jobs average ≥ 4.0/5". It is
  also the mitigation for the brand's biggest liability: the moment we recommend a
  vendor, a bad job is our fault. Ratings attach to the round, so a vendor's score
  is the honest aggregate of jobs they actually did.

#### FEAT-009 · Rating UI, resident and admin
- **What:** Residents rate from My Requests; operators see average ratings per
  vendor and per round.
- **Why:** The number has to be visible to the person who chooses the next vendor.
- **Website angle:** "Vendors earn their place."

---

### Section E — Built for a phone in a society

#### FEAT-001 · Society onboarding and phone-OTP auth
- **What:** A resident enters their society's invite code and phone number, gets
  a one-time code by SMS, and is in. Every row of data is scoped to a society.
- **How it is used:** No passwords, no email, no paperwork. The invite code binds
  the resident to the right society; the OTP proves the phone.
- **Why:** Phones are the identity in Indian societies. Multi-tenancy from day one
  guarantees a resident can only ever see their own society's rounds and prices.
  OTPs live in Redis with a TTL and rate limit and are never logged or returned.

#### FEAT-013 · One OTP, then signed in for good
- **What:** Sessions do not expire. Verify once per device.
- **Why:** Residents use the app seasonally (AC before summer, pest control
  quarterly). Being asked for an OTP every visit kills a 30-second session.

#### FEAT-012 · Admin sign-in by phone, on its own page
- **What:** The operator signs in with just a phone number on a dedicated page.
- **Why:** Admins have no society invite code; forcing one was wrong. Separate page,
  separate rate limits, and the sign-in is hardened against OTP denial.

#### FEAT-008 · PWA shell: installable and offline-friendly
- **What:** Add to home screen, thumb-reachable tab bar (Home · Services · My
  Requests · Profile), a clear "you are offline / data is stale" state, one-tap
  update to a new version, and a Profile with log out.
- **Why:** No app-store friction, and Indian mobile data drops. A resident who
  loses signal mid-round must never mistake a network failure for "my round
  disappeared". Admin controls fail fast offline instead of hanging.

#### FEAT-016 · Premium phone-app feel: dark mode, sheets, native chrome
- **What:** Light / dark / system scheme with a Telegram-style circular reveal
  when you switch; bottom sheets for every "do one thing" moment (pledge, rate,
  appearance); large titles that collapse into a blurred bar on scroll; safe-area
  aware; the phone's status bar colour follows the scheme.
- **Why:** A PWA that feels like a website gets ignored; one that feels native gets
  installed. Dark mode is a palette-tinted night, never flat black, with every
  text/surface pair tested for contrast in both schemes.

---

### Section F — A look you want to open

#### FEAT-011 · Resident UI redesign: themeable design system, motion, skeletons
- **What:** A token-based design system (colour, radius, type as CSS variables), a
  motion layer that collapses under reduced-motion, and loading skeletons that
  match the real layout.
- **Why:** Trust is visual. A token layer also means a new look is CSS, not a
  rewrite, which is what made the next three features cheap.

#### FEAT-017 · Vercel-style "Mono" look, day and night
- **What:** Flat monochrome surfaces, crisp 1px hairlines, tight radii, Geist type,
  a faint grid ground, black primary button by day that turns white by night.
- **Why:** The owner wanted the Vercel register: calm, precise, modern. It became
  the default for every new device.

#### FEAT-019 · One Vercel look, seven colour combinations, micro-interactions
- **What:** Look and colour are separate: the Vercel geometry always stays, and
  the resident picks one of seven two-tone accents (mono, ocean, aurora, bloom,
  sunset, forest, lagoon). Micro-interactions: cursor spotlight on cards, a light
  beam travelling the lead card's border, sparkles on "Could save" and "Best price
  unlocked", shimmer on the headline saving, a spark burst on join. All off under
  reduced motion.
- **Why:** Choice without losing coherence, and small delights that make the
  savings feel earned.
- **Website angle:** show the same screen in three accents, light and dark.

#### FEAT-015 · Server-side filters, URL filter state, filtering UI
- **What:** Search and category/status filters on every list (resident catalog;
  admin services, vendors, rounds), executed on the server, stored in the URL so
  a refresh or shared link keeps them. Debounced search, no flicker, animated
  result count, a distinct "no match" state with Clear filters.
- **Why:** A 23-service catalog and multi-society round lists need real search;
  URL state makes any filtered view shareable with a neighbour or a colleague.

---

### Section G — Small things that make it feel finished

#### FEAT-023 · Home leads with group buys
- **What:** The Home screen opens on an accent card with live counts of open rounds and
  the three rounds closing soonest, each one tap from its pledge sheet.
- **Why:** The first screen must answer "what can I save on today?" before anything else.

#### FEAT-024 · Confirm before destructive actions
- **What:** Logging out, leaving a round, removing a rating, withdrawing an ask, and
  admin cancel or deactivate all pass through one confirm sheet that is always closable
  and honest when offline.
- **Why:** A mis-tap must never cost a neighbour their place in a round.

#### FEAT-025 · Server-side pagination
- **What:** Every list loads a page at a time with an explicit "Show more"; pickers walk
  all pages.
- **Why:** Lists stay fast as societies and rounds grow; nothing is silently cut off.

#### FEAT-026 · Dev mode shows the OTP as a toast
- **What:** In a development build only, the one-time code arrives as a toast at the top
  of the sign-in screen. The route and bundle path do not exist in production, and the
  gate fails if they do.
- **Why:** Faster demos and testing without ever weakening production sign-in.
- **Website angle:** do not mention; internal tooling.

---

## 4. Platform guarantees worth saying out loud

These are not single features but are true across the product and belong in a
"Why trust it" block or an FAQ.

- **Society-scoped by design.** Every tenant row carries a society id, enforced in
  the service layer, never trusted from the client. Your society's price is yours.
- **Counts cannot lie.** Unit counts and all status changes go through one
  transactional service with row locks; Redis is only for display and rate limits.
- **Messages match reality.** Notifications are written in the same transaction
  as the event, deduplicated by key, so no phantom or double messages.
- **Privacy-minimal.** Phone numbers are the only personal data; OTPs are never
  logged or returned; shared invite links carry no personal data.
- **No payment data.** v1 has no gateway; the app stores a "collected" flag only.
- **Production-hardened.** Security headers, rate limits, no auth bypass, Docker
  images, CI, and a runbook (CHORE-007); a single verify gate runs every test and
  build before anything ships.
- **Accessible motion.** Every animation collapses under `prefers-reduced-motion`;
  all text meets WCAG contrast in light and dark.

---

## 5. Suggested resident journey for the website narrative

1. **Open the app** → see "AC servicing · 6 of 10 · closes in 4 days · ₹800 now, ₹700 at 10".
2. **Tap Join, pick 2 ACs** → pledge sheet, spark burst, SMS confirmation.
3. **Invite neighbours** → share to the society group; ladder fills; "Best price unlocked".
4. **Deadline passes** → round closes itself, "met", everyone told the final price.
5. **Operator assigns the vendor** → "Vendor scheduled" message.
6. **Job delivered** → rate 1–5 from My Requests.
7. **Next season** → still signed in; a service with no round? "Ask for this".

---

## 6. Not yet / do not claim

| Item | Status | Say on the website |
|------|--------|--------------------|
| WhatsApp round updates | planned fast-follow behind the same channel interface | "SMS today, WhatsApp next" |
| Online payments (UPI / Razorpay) | explicit non-goal for v1 | "Pay the vendor directly; we track it" |
| Vendor app or login | explicit non-goal for v1 | do not mention |
| In-app chat / support desk | explicit non-goal for v1 | "Support over phone and WhatsApp" |
| Multi-city / regional admin | architecture supports it, no tooling built | "One city at a time" |
| Grocery baskets, fresh produce, delivery slots | out of scope; staples pilot only | "Bulk staples only, for now" |
| Recurring plans, warranty through us | v2 idea | roadmap only |

---

## 7. Quick reference table

| ID | Feature | Website section | Status |
|----|---------|-----------------|--------|
| FEAT-001 | Society onboarding + phone-OTP auth | E | done |
| FEAT-002 | Service catalog per society | B | done |
| FEAT-003 | Group-buy rounds: join, units, tiers, live counter | A | done |
| FEAT-004 | Round lifecycle + scheduled closing | A | done |
| FEAT-005 | Super-admin dashboard: demand, vendor, delivered, paid | D | done |
| FEAT-006 | Notifications, SMS-first | C | done |
| FEAT-007 | Post-service rating | D | done |
| FEAT-008 | PWA shell: installable + offline-friendly | E | done |
| FEAT-009 | Rating UI, resident + admin averages | D | done |
| FEAT-010 | Per-service unit labels | A | done |
| FEAT-011 | Resident UI redesign, design system, motion, skeletons | F | done |
| FEAT-012 | Admin sign-in by phone, own page | E | done |
| FEAT-013 | One OTP, signed in for good | E | done |
| FEAT-014 | Admin services page, categories, wider catalog, staples pilot | B | done |
| FEAT-015 | Server-side filters, URL state, filter UI | F | done |
| FEAT-016 | Dark mode, sheets, native chrome | E | done |
| FEAT-017 | Vercel-style Mono look | F | done |
| FEAT-018 | Rounds that feel alive: ladder, countdown, invite, celebrate | A | done |
| FEAT-019 | One look, seven accents, micro-interactions | F | done |
| FEAT-020 | Web push notifications | C | done |
| FEAT-021 | Service to booking in one tap | B | done |
| FEAT-022 | "Ask for this service" | B | done |
| FEAT-023 | Home leads with group buys | G | done |
| FEAT-024 | Confirm before destructive actions | G | done |
| FEAT-025 | Server-side pagination | G | done |
| FEAT-026 | Dev-mode OTP toast (internal, not for the website) | G | done |

Specs, plans and acceptance criteria for each: `loop/work/FEAT-NNN-*/`.
Product scope and non-goals: `BRIEF.md`. Design tokens and look: `DESIGN-SYSTEM.md`.
