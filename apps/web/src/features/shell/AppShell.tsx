import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { UpdatePrompt } from './UpdatePrompt';

/**
 * Resident app shell (FEAT-008): offline/update strips above the page, tab bar
 * below it. `pb-28` reserves room for the fixed bar so the last card of any page
 * stays reachable; the bar itself adds the iOS safe-area inset on top of that.
 *
 * Wraps resident routes ONLY — `/onboard` has no navigation and `/admin/*` has
 * its own (AC2).
 *
 * FEAT-011 adds the ground it all sits on: three slow-drifting washes and a grain
 * layer, both fixed and inert, so scrolling a screen moves the content across the
 * light rather than dragging the light with it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <AmbientGround />
      {/* One sticky container, not two sticky siblings: both strips were
          `sticky top-0` and the banner painted over the update prompt when
          offline with a worker waiting (V2 P2-8). */}
      <div className="sticky top-0 z-20 flex flex-col gap-2 px-4 pt-3">
        <UpdatePrompt />
        <OfflineBanner />
      </div>
      <div className="relative z-0 pb-28">{children}</div>
      <BottomNav />
    </div>
  );
}

/**
 * Decoration only — `aria-hidden`, `pointer-events-none`, and every animation in
 * it stops under prefers-reduced-motion (theme.css). The blur is on a fixed layer
 * behind the content, so it is composited once rather than per card.
 */
function AmbientGround() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="animate-drift-a absolute -left-24 -top-28 h-72 w-72 rounded-full bg-mesh-1/55 blur-[46px]" />
      <div className="animate-drift-b absolute -right-28 top-44 h-80 w-80 rounded-full bg-mesh-2/45 blur-[46px]" />
      <div className="animate-drift-c absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-mesh-3/40 blur-[46px]" />
      {/* Film grain: it is what stops large flat washes from banding on OLED phones. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.055] mix-blend-overlay">
        <filter id="app-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#app-grain)" opacity="0.55" />
      </svg>
    </div>
  );
}
