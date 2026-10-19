# FEAT-024 — plan

Frontend only; no new dependency; no ADR (ADR-0022 primitives, ADR-0028 sheet).

1. `components/ui/confirm-sheet.tsx` — `ConfirmSheet({ open, onClose, title, consequence,
   confirmLabel, pendingLabel?, busy?, error?, onConfirm })`. Body = the consequence line;
   footer = danger confirm + ghost "Keep" cancel. Tests.
2. `features/auth/SignOutButton.tsx` — owns the confirm; used by Home (icon) and Profile (wide).
3. RoundsPage pledge sheet: "Leave this round" → opens ConfirmSheet; confirm → `leave.mutate`.
4. RateRound: "Remove" → ConfirmSheet; confirm → `remove.mutate`.
5. AdminRoundDetailPage: inline box → ConfirmSheet (keep `cancel-confirm` test id on the sheet).
6. Tests per call site; DESIGN-SYSTEM.md primitives table gains the row.
