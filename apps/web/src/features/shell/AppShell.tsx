import type { ReactNode } from 'react';
import { AmbientGround } from '../../components/ui/ambient-ground';
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

