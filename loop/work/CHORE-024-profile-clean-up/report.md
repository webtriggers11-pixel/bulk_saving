# CHORE-024 — Profile: the "This app" card is cluttered; one clean settings list

**Status:** triaged · **Priority:** P2 · **Opened:** 2026-10-19 · **Reporter:** owner (screenshot of the "Add to your home screen" card: a filled button and a "Connected" pill jammed on one line; "fix this card design, also check overall, I want a clean one")

## What is wrong

- The install card mixes three jobs: an install CTA, an iOS how-to paragraph, and a live connection pill — on a tinted surface with a breathing icon. It reads as noise next to the Appearance and Notifications rows, which share one quiet row shape.
- The page has three row shapes (tile, tinted feature card, settings row) for what is one list of device settings.

## Intent

One settings list, one row shape (icon · title · one line · trailing control):
- **Install app** row — trailing: `Install` button when installable; "Installed" text when standalone; iOS hint as the row's line otherwise. Same `install-hint` / `installed-note` test ids.
- **Connection** becomes a quiet status under the identity hero ("Connected" dot · or the offline line), `connection-state` test id kept.
- Appearance and Notifications rows unchanged in shape; the install row adopts theirs.
- No new primitive: the row is the existing `surface-solid … rounded-card p-[18px]` shape already used twice on this page (extract a local `SettingsRow` so the three stop drifting).

## Done when

ProfilePage tests green (ids kept), class gate green, a browser pass at 390px and desktop shows one consistent list; V2; V3.
