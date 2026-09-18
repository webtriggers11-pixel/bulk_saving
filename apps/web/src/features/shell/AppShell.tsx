import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { UpdatePrompt } from './UpdatePrompt';

/**
 * Resident app shell (FEAT-008): offline/update strips above the page, tab bar
 * below it. `pb-20` reserves room for the fixed bar so the last card of any page
 * stays reachable; the bar itself adds the iOS safe-area inset on top of that.
 *
 * Wraps resident routes ONLY — `/onboard` has no navigation and `/admin/*` has
 * its own (AC2).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* One sticky container, not two sticky siblings: both strips were
          `sticky top-0` and the banner painted over the update prompt when
          offline with a worker waiting (V2 P2-8). */}
      <div className="sticky top-0 z-20 flex flex-col">
        <UpdatePrompt />
        <OfflineBanner />
      </div>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </div>
  );
}
