import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CrashCard, ErrorBoundary } from '../../components/ErrorBoundary';
import { AmbientGround } from '../../components/ui/ambient-ground';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { UpdatePrompt } from './UpdatePrompt';
import { useSessionSync } from './useSessionSync';

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
  // BUG-011: a crashed screen stays inside this boundary; the tab bar survives, and
  // moving to another tab (a new path) clears the crash.
  const { pathname } = useLocation();
  // One place for the whole resident app to keep its session in step (CHORE-009).
  useSessionSync();

  return (
    <div className="relative min-h-screen">
      <AmbientGround />
      {/* One sticky container, not two sticky siblings: both strips were
          `sticky top-0` and the banner painted over the update prompt when
          offline with a worker waiting (V2 P2-8). */}
      {/* Same column as the screens below it: the strips were full-bleed, so on
          anything wider than a phone their text started far left of the content
          they are about — and on the same 22px gutter as the cards, not a 16px one
          that left them 6px wider than everything they float above (CHORE-009). */}
      <div className="sticky top-0 z-20 mx-auto flex max-w-md flex-col gap-2 px-[22px] pt-[max(12px,env(safe-area-inset-top))]">
        <UpdatePrompt />
        <OfflineBanner />
      </div>
      <div className="relative z-0 pb-28">
        <ErrorBoundary
          resetKey={pathname}
          fallback={(reset) => (
            <div className="mx-auto max-w-md p-[22px]">
              <CrashCard onRetry={reset} />
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      </div>
      <BottomNav />
    </div>
  );
}

