# BRIEF — Bulk Saving

> Working title. A demand-aggregation (group-buy) platform for home services,
> scoped to residential building societies.

**Type:** Business / startup (founder-operated)
**Path:** Client/business
**Date:** 2026-09-15
**Complexity:** L — see sizing below
**Agentic:** Not detected — go straight to `architect:`

---

## Problem

Residents of urban Indian housing societies regularly need home services — AC
servicing, pest control, deep cleaning, bathroom wash, painting — but each pays
full single-customer price (e.g. ~₹1000 for one AC service) because they book a
vendor alone. Within the same society, many neighbours want the *same* service in
the *same* period, but they don't know each other's intent and can't coordinate
timing, so the collective bargaining power is never captured.

**How it's solved today:** Each resident calls a vendor individually (via
UrbanClap/Urban Company or a local contact), pays full price, and coordinates
alone. Society WhatsApp groups occasionally self-organise a group booking, but
ad-hoc, unreliable, and with no price leverage or accountability.

**Cost of the problem:** A resident overpays roughly ₹300 per service versus what
pooled demand could negotiate (₹1000 → ~₹700 in the AC example). Vendors carry
high per-job acquisition + travel cost, which pooling structurally removes — so
the discount is real economics, not a subsidy. Residents also skip services
entirely to avoid the hassle and cost.

---

## Primary user

**Resident (demand side):** A working adult in an urban Indian housing society
(typ. 100–400 flats) who wants a common home service done, is price-sensitive,
lives on WhatsApp, and does not want to organise a group booking themselves.
Uses the platform occasionally/seasonally (AC pre-summer, pest control quarterly).

**Super-admin (supply/ops side):** The founder/operator who sees aggregated
demand across societies, negotiates a bulk price with a vendor offline, sets the
final price, assigns the job, and tracks manual payment collection.

---

## Core value

**"I get everyday home services genuinely cheaper by pooling demand with my
neighbours — without having to organise anything myself."**

Single outcome: a cheaper, trusted service unlocked by neighbour pooling, with
zero coordination effort from the resident. Every v1 feature must serve this.

---

## Success criteria (v1)

**Primary signal — proves both sides of the model work:**
- **≥ 3 service rounds hit their threshold** across the pilot societies, AND
- **delivered jobs average ≥ 4.0 / 5 resident rating.**

Demand aggregating (rounds filling) proves the mechanic; the rating proves
vendors actually deliver — the real risk in any services marketplace.

**Failure looks like:** rounds consistently fail to fill (no demand liquidity),
or rounds fill but delivery quality is poor and residents don't return.

**Timeline:** first real society live in **4–6 weeks** (lean MVP).

---

## v1 features

Every feature serves the core value (cheaper service via effortless pooling).

1. **Society onboarding + auth** — resident enters a society-specific invite code,
   verifies via phone OTP (SMS). Binds resident ↔ society. Multi-tenant from day one.
2. **Service catalog** — residents browse the services available to their society.
3. **Group-buy rounds (the core mechanic)** — window + threshold. Each round shows
   live join count, target, deadline, and price tier ("6 of 10 joined · closes in
   4 days · unlocks ₹700"). Residents join with one tap. Urgency + shared deadline
   solve the "everyone wants it at a different time" problem.
4. **Super-admin dashboard** — see aggregated demand by society/service, open/close
   rounds, set the vendor + final negotiated price, assign the job, and **mark
   payment collected + job delivered** (manual, no gateway).
5. **Notifications** — SMS for OTP; WhatsApp for round updates/reminders (join
   confirmations, "round closing soon", "vendor scheduled"); PWA web-push as a
   bonus for installed users.
6. **Post-service rating** — resident rates a delivered job (1–5). Feeds the
   success metric and vendor accountability. Required for v1, kept minimal.
7. **PWA shell** — installable, mobile-first, works on a flaky connection.

### Navigation (resident PWA)
`Home` (active rounds for my society) · `Services` (catalog) · `My Requests`
(rounds I've joined + their status) · `Profile`

### Navigation (super-admin)
`Dashboard` (demand overview) · `Rounds` · `Vendors` · `Payments` · `Societies`

---

## Non-goals (v1 explicitly does NOT include)

1. **Online payment gateway** — no Razorpay/UPI. Payment is tracked as a manual
   "collected" flag set by the super-admin. *(Confirmed by founder.)*
2. **Vendor self-serve portal** — vendors have no login/app; all coordination is
   offline via the super-admin. *(Deferred to v2+.)*
3. **Multi-city / regional-admin tooling** — architecture is multi-tenant and
   supports it, but no city-management, franchise, or regional-admin features are
   built. One operational region. *(Derived from 4–6 week scope — confirm.)*
4. **In-app chat / support desk** — no built-in messaging between residents,
   admin, or vendors; support runs over phone/WhatsApp. *(Derived — confirm.)*

---

## Market & differentiation

- **Urban Company / UrbanClap:** individual booking at full price. We differ by
  **group-buy pricing + society-scoped trust.** Not a direct substitute.
- **MyGate / ADDA / NoBroker:** own society distribution and are expanding into
  services — the **biggest strategic threat**. If group-buy works, they can copy
  the mechanic with distribution we'd spend years building.
- **Ad-hoc society WhatsApp group bookings:** the real status quo. We formalise
  it with a threshold mechanic, vendor negotiation leverage, and accountability.

**Defensibility is execution, not the idea:** vendor relationships, recurring
plans (v2), and delivery quality — not the group-buy concept itself.

**Build vs buy:** no off-the-shelf product does society-scoped demand aggregation
for services; build is justified.

---

## UI direction

- **Platform:** mobile-first PWA (installable), super-admin uses a web dashboard.
- **Interaction:** quick — resident sessions are ~30s (browse, tap join, done).
- **Feel:** trustworthy, modern, community — clear price savings front and centre,
  progress/urgency of rounds made vivid.

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | **NestJS** (Node) | Structured, modular, good for multi-tenant + role-based domains |
| DB | **PostgreSQL** | Relational data (societies, residents, rounds, jobs); strong multi-tenant support |
| Cache/queue | **Redis** | Live round counters, OTP rate-limiting, notification/job queues |
| Frontend | **React PWA** (Vite) | Installable, offline-friendly, no app-store friction |
| Notifications | SMS (OTP) + WhatsApp Business API (updates) + web-push | India reach; WhatsApp is where societies live |

Stack fits: backend is genuinely needed (auth, OTP, multi-tenant, third-party
messaging, round state machine). Not over-engineered.

---

## Constraints

- **Timeline:** first society live in 4–6 weeks. Hard-ish (forces scope discipline).
- **Payments:** manual collection only in v1 (non-goal above).
- **Geography:** one city, India. Currency ₹ (INR). Multi-tenant arch, single-region ops.
- **Footprint target:** 10+ societies in one city — but see risk R5 (pilot-first).
- **Decision-maker:** founder (sole sign-off). No external client committee.
- **Compliance:** phone numbers = personal data; store minimally, handle OTP + PII
  responsibly. No payment/financial data in v1 (no gateway).

---

## Risks

- **R1 — WhatsApp Business API setup/approval** is a real integration + timeline
  risk for a 4–6 week MVP. *Mitigation: SMS must be able to ship as the sole
  channel; WhatsApp updates can be a fast-follow if approval slips.*
- **R2 — Demand liquidity per society:** thresholds may not fill. *Mitigation:
  low/tiered thresholds, "interest vs committed" states, seasonal timing (AC pre-summer).*
- **R3 — Quality liability:** the moment we recommend a vendor, a bad job is our
  brand's fault. *Mitigation: ratings + before/after accountability (rating in v1).*
- **R4 — Disintermediation:** a resident who meets a good vendor books them
  directly next time, cutting our commission. *Mitigation (v2): own the relationship
  via recurring plans + warranty through us.*
- **R5 — Operational scaling:** manual ops across 10+ societies is heavy before
  quality is proven. *Recommendation: software supports 10+, but treat the first
  1–3 societies as a proving ground before pushing all of them.*
- **R6 — Timeline vs complexity:** L-complexity in 4–6 weeks is aggressive.
  Ratings + WhatsApp are the first candidates to slip to fast-follow if needed.

---

## Complexity

**L (Large).** Drivers: multi-tenant data model, two user types (resident +
super-admin) with role-based access, phone-OTP auth, a stateful round lifecycle
(open → filling → threshold-met/expired → assigned → delivered → rated), and a
third-party messaging integration (WhatsApp Business API). Not XL — no AI, no
payments, no real-time collaboration, single region.

---

## Agentic flag

**false.** No AI/agent logic in scope. Proceed directly to `architect:`.

---

## Resolved decisions

1. **Non-goals #3 (multi-city tooling) and #4 (in-app chat): confirmed out** of v1.
2. **Multiple units per resident:** allowed — a resident can request N units (e.g.
   2 ACs) in a single round. Rounds count **units**, not people, for thresholds.
3. **Multiple price tiers:** supported — a round can define tiered thresholds
   (e.g. 5 units → ₹800, 10 units → ₹700). Price shown reflects the current tier.

## Open questions (resolve during architecture)

1. Does the super-admin manage a **vendor list** in v1, or just type a vendor name
   per round? *(Lean toward a minimal vendor list — needed for ratings/accountability.)*
2. WhatsApp Business API: do we have (or can we get) an approved sender in time,
   or plan **SMS-first** with WhatsApp as a fast-follow? *(See risk R1.)*

---

## Architecture decisions
> Decided during architect: — 2026-09-16. Full detail in ARCHITECTURE.md.

- Project type: full-stack web app (React PWA + NestJS API), monorepo
  (`apps/backend` + `apps/web` + `packages/shared`)
- Multi-tenancy: shared schema, `societyId` on tenant-scoped rows, enforced at service layer
- Round concurrency: Postgres authoritative for unit counts; Redis display/rate-limit only
- Round lifecycle: explicit state machine in `RoundService`
  (OPEN → CLOSED_MET/CLOSED_EXPIRED → ASSIGNED → DELIVERED → RATED, + CANCELLED)
- Deadlines: BullMQ delayed jobs close rounds
- DB access: Prisma (chosen over TypeORM)
- Auth: phone+OTP (OTP in Redis w/ TTL + rate-limit), JWT access+refresh, roles RESIDENT|SUPER_ADMIN
- Notifications: `NotificationChannel` interface, SMS-first, WhatsApp fast-follow, BullMQ-queued
- Frontend: React+Vite PWA, feature-based, TanStack Query (server) + Zustand (UI), Tailwind + shadcn/ui
- TypeScript: strict, no `any` (both apps)
- Testing: Jest (backend unit+integration), Vitest+RTL (frontend); concurrency + state transitions mandatory-tested; E2E deferred
- Code quality: ESLint strict + Prettier + conventional commits + pre-commit hooks; pinned deps, npm audit

## Next step

```
new: Bulk Saving group-buy home-services platform
```
`new-app:` reads BRIEF.md + ARCHITECTURE.md and scaffolds the project kit.

---

## Scope changes

- **2026-10-17 — Bulk staples pilot (FEAT-014, ADR-0025).** Owner approved adding grocery as
  **bulk staples only**: a single product in a fixed pack (25 kg rice, 15 L oil, 10 kg atta),
  pooled through the existing round mechanic and delivered once to the society. Mixed
  baskets, fresh produce, inventory and delivery slots remain out of scope. Success test:
  do staples rounds fill as services do? Revisit after 3 close.
