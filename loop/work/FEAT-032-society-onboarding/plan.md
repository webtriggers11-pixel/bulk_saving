# Plan FEAT-032

Backend (`apps/backend/src/modules/societies`):
1. `invite-code.ts`: `generateInviteCode()` using `crypto.randomInt` over `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
2. `SocietiesService`: `listAll` with `_count` (residents, rounds); `getAdmin(id)`; `create`, which retries up to 5× on Prisma P2002;
   `update`; `rotateInviteCode`; `remove`, which checks the counts inside a transaction → 409 CONFLICT.
3. `societies.dto.ts` (class-validator, trimmed, name 2–80, city 2–60); `AdminController` routes; `@HttpCode(204)` on delete.
4. Shared: extend `AdminSocietyDto`; add `CreateSocietyBody` and `UpdateSocietyBody`.
Web (`apps/web/src/features/admin`):
5. `admin.api.ts` + `useAdmin.ts` hooks (invalidate `adminKeys.societies`).
6. `AdminSocietiesPage.tsx` (list + create sheet), `AdminSocietyDetailPage.tsx` (code, link, QR via the existing `qrcode` dep,
   invitation, print poster, rotate/edit/delete through ConfirmSheet). `invitation.ts` builds the link and message (pure, tested).
7. `print` CSS: `@media print` shows only `[data-print-poster]`.
8. Routes and nav; OnboardingPage reads `?code=`.
Approved: autonomous mode (owner standing instruction).
