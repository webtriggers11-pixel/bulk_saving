# Test logins — local development only

These are the sign-in details for the **Web PWA** (React + Vite) on a developer machine.
Every account here is seeded test data. None of these numbers or codes work in
production. Production refuses the dev OTP settings at boot (ADR-0020, ADR-0040).

## 1. Before you sign in

| Step | Command | Why |
|---|---|---|
| Start the backend | `pnpm --filter backend dev` | API on `http://localhost:3000` |
| Start the web app | `pnpm --filter web dev` | PWA on `http://localhost:5173` (a **dev** build) |
| Seed base data | `pnpm --filter backend seed` | 2 societies, the catalog, the platform admin |
| Seed demo data | `pnpm --filter backend seed:demo` | The demo residents, vendors and rounds below (localhost DB only) |

> If the global `pnpm` shim is broken on this machine, use `corepack pnpm …`.

`apps/backend/.env` must contain these lines (it already does on this machine):

```env
NODE_ENV=development
OTP_DEV_LOG=true          # turns on the dev OTP toast (GET /dev/otp)
OTP_DEV_FIXED_CODE=1111   # every resident and admin OTP is 1111
```

## 2. The OTP shows as a toast at the top

After you tap **Send code**, a toast slides in at the **top** of the screen:

> **DEV ONLY** · Your code is **1111** · [Use it]

Tap **Use it** to fill the code field, then tap **Verify**. The same toast appears on
both doors: resident onboarding (`/onboard`) and admin login (`/admin/login`).

How it works (FEAT-026, ADR-0037). Once the code is "sent", the web app calls the
dev-only route `GET /dev/otp?phone=…`, which reads the code the stub SMS channel saved
in Redis (`dev:last-otp:<phone>`, kept for 120 s). The auth responses never include the code.

The toast only appears when **all** of these are true:

- The web app runs as a **dev build** (`pnpm --filter web dev` on :5173). The
  preview/production build (:5175) leaves this code out on purpose.
- The backend has `OTP_DEV_LOG=true` and `NODE_ENV=development`.
- The browser and the backend are on the **same machine**. The route only answers
  loopback callers, so a phone on the LAN won't get the toast. Type `1111` there instead.

If the toast doesn't show, type `1111` by hand. It always verifies in development.

## 3. Resident logins — `http://localhost:5173/onboard`

Flow: **invite code → (choose SMS if WhatsApp is offered) → phone → Send code → toast → Verify**. The phone field shows a fixed `+91`; type only the 10 digits.
A society's QR code or join link (`/onboard?code=XXXX`) opens this page with the invite code already filled in.
You can type a phone number as `9999900101` or `+919999900101`. Both are the same resident (BUG-019).

### Societies (invite codes)

| Invite code | Society | City |
|---|---|---|
| `GREEN001` | Green Meadows | Pune |
| `BLUE0002` | Blue Waters | Mumbai |

### Residents (from `seed:demo`)

| Name | Phone | Invite code | Role | Notes |
|---|---|---|---|---|
| Asha Rao | `+919999900101` | `GREEN001` | RESIDENT | Main demo resident: has a round in every state |
| Vikram Mehta | `+919999900102` | `GREEN001` | RESIDENT | |
| Neha Kulkarni | `+919999900103` | `GREEN001` | RESIDENT | |
| Rahul Desai | `+919999900104` | `GREEN001` | RESIDENT | |
| Priya Iyer | `+919999900105` | `GREEN001` | RESIDENT | |
| Arjun Nair | `+919999900106` | `GREEN001` | RESIDENT | |
| Meera Joshi | `+919999900107` | `GREEN001` | RESIDENT | |
| Kabir Shah | `+919999900108` | `GREEN001` | RESIDENT | No rounds: use this one to see the empty states. On this machine's DB the number now belongs to a real sign-in renamed "Web Triggers" |
| Farah Khan | `+919999900201` | `BLUE0002` | RESIDENT | |
| Rohan Pillai | `+919999900202` | `BLUE0002` | RESIDENT | |
| Ananya Sen | `+919999900203` | `BLUE0002` | RESIDENT | |
| Dev Malhotra | `+919999900204` | `BLUE0002` | RESIDENT | |

**New resident:** with a valid invite code, any phone number that isn't listed above
creates a new resident after you verify. Fill in the name field when it asks.

## 4. Admin logins — `http://localhost:5173/admin/login`

Flow: **phone → Send code → toast → Verify** (no invite code). The phone field shows a fixed `+91`; type only the 10 digits. After you sign in you land on `/admin`.

| Name | Phone | Role | Seeded by | Notes |
|---|---|---|---|---|
| Platform Admin | `+919999900001` | SUPER_ADMIN | `seed` | Main admin (Green Meadows) |
| Ops Admin | `+919999900209` | SUPER_ADMIN | `seed:demo` | Second admin, so browser testing doesn't use up the main admin's OTP limit |

The OTP is `1111` in dev. In other environments an admin's OTP is **8 digits** and a resident's is **4** (CHORE-026).

## 5. The admin console (what an admin can do)

Desktop: a left sidebar. Phone: the menu button opens the same nav as a drawer.

| Section | Path | What you can do |
|---|---|---|
| Dashboard | `/admin` | Platform numbers (societies, users, admins, open rounds), quick actions, newest societies and users, demand and rounds |
| Societies | `/admin/societies` | Create a society (the invite code is generated for you); open one for its **QR code, join link, printable A4 poster, invitation message** (Copy, Share, Send on WhatsApp); rename; **new invite code**; **active/inactive** (an inactive code admits nobody); delete (only while empty) |
| Users | `/admin/users` | Every user in every society: search by name or phone, filter by society, access or status. Open a user for **profile, access (Resident/Admin), switch on/off, every group buy they joined, remove** (only without group-buy history; otherwise switch them off) |
| New round | `/admin/rounds/new` | Open a group buy |
| Services / Vendors | `/admin/services`, `/admin/vendors` | Catalog and vendor management |

Guards: you can't change your own access, switch yourself off, or remove yourself, and the last active admin can't be demoted, switched off or removed. A switched-off user can't sign in and is signed out everywhere.

## 6. Vendors (data only, they can't sign in)

| Vendor | Phone | Category | Active |
|---|---|---|---|
| CoolBreeze AC Services | `+919888800001` | Appliances | yes |
| ShieldPro Pest Control | `+919888800002` | Home Care | yes |
| SparkleHome Cleaning | `+919888800003` | Home Care | yes |
| ColourCraft Painters | `+919888800004` | Renovation | yes |
| OldTown Pest Co. | `+919888800005` | Home Care | **no** |
| Shree Balaji Wholesale | `+919888800006` | Bulk Staples | yes |
| AquaClean Tank Services | `+919888800007` | Utilities | yes |

## 7. Good to know

- **OTP request limits:** sending is rate-limited per phone and per client. An admin
  gets 5 per hour. If you hit "try again later", use the other admin, or clear the
  limit keys in your **local** Redis.
- **Sessions don't expire** in dev (`JWT_REFRESH_TTL_SECONDS=0`, ADR-0024). Use
  **Profile → Log out** to switch accounts.
- **WhatsApp "Tap to verify"** (FEAT-027) only shows when the backend has WhatsApp
  credentials. SMS + OTP is always offered as well.
- **Read an OTP without the UI:** `curl "localhost:3000/dev/otp?phone=%2B919999900101"`
  (from the same machine, within 120 s of sending).
