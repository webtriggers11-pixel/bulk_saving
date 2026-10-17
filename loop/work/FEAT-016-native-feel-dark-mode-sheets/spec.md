# FEAT-016 — Premium phone-app feel: dark mode with a Telegram-style switch, sheets, native chrome

**Status:** done · **Priority:** P1 · **Opened:** 2026-10-18 · **Asked by:** owner
("better UI/UX, dark mode light mode similar to telegram effect and much more like using
sheets and all so it look premium phone app look") · **Decisions:** ADR-0028 (builds on ADR-0021/0022)

## Design plan (frontend-design pass)

The identity stays (ADR-0021 — Plus Jakarta Sans, liquid-glass surfaces, three palettes);
this item makes it behave like a native app and gives it a night.

- **Night palette, not inverted day.** Ground is a palette-tinted deep charcoal, never
  #000/#111 (the generic "dark mode" tell): teal night ≈ #0C1615, indigo night ≈ #0E0F1E,
  ember night ≈ #17100D. Glass becomes smoked glass — `paper` at 6–14% over the ground with
  a faint top highlight — so the same surface ranks read in both schemes. Brand fills keep
  their hue; brand INK lifts to a light tint (≥4.5:1 on night ground). State hues get night
  variants (they are meanings, so they stay fixed across palettes, as by day).
- **The one memorable moment:** the scheme switch. Tapping the sun/moon reveals the new
  scheme as a circle growing from the button (View Transitions, ~520ms, ease-out) — the
  Telegram night-mode gesture. Everything else stays quiet. Instant under reduced motion
  or without View Transitions.
- **Sheets for every "do one thing" moment:** pledging units, rating a job, appearance
  settings, and (admin, phone width) adding a service. Bottom sheet with grabber, drag to
  dismiss with velocity, backdrop dim, focus trapped, Escape/backdrop closes; a centred
  sheet on wide screens.
- **Native chrome:** large title that hands over to a compact blurred bar on scroll;
  safe-area insets (viewport-fit=cover); a tab bar whose active pill slides between tabs;
  `theme-color` follows the scheme so the phone's status bar matches.

## Acceptance criteria

- **AC1** `data-scheme="light|dark"` on <html>, orthogonal to `data-theme` (palette). A
  preference of light / dark / system, remembered per device; "system" follows the OS live.
  No flash of the wrong scheme on load (applied by an inline script before paint).
- **AC2** Every token has a night value in every palette; text meets 4.5:1 (body) / 3:1
  (large) on its surface in BOTH schemes — asserted by test, like the day palette is.
- **AC3** No component hard-codes a light-only colour: light-surface overlays use `paper`;
  `white` remains only on brand/accent fills. Asserted by test.
- **AC4** Scheme switch with the circular reveal from the control's centre; instant under
  reduced motion / no View Transitions; `theme-color` meta updated.
- **AC5** `Sheet` primitive (dialog semantics, focus trap + restore, Escape, backdrop,
  drag-to-dismiss, safe-area padding, reduced-motion) covered by the class-conflict and
  primitive guards; used for Appearance, pledge, rating, and admin add-service on phones.
- **AC6** Large-title → compact bar; safe-area insets; sliding tab indicator.
- **AC7** Browser pass of every screen in both schemes at phone width.

## Out of scope

Pull-to-refresh, haptics, swipe-back navigation, per-screen palettes.
