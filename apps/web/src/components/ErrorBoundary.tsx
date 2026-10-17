import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** What to draw instead of a crashed subtree; `reset` re-renders it from scratch. */
  fallback: (reset: () => void) => ReactNode;
  /**
   * When this changes, a crashed boundary clears itself — the route path, so navigating
   * away from a broken screen lands on a working one rather than on the same error card.
   */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
  key: unknown;
}

/**
 * BUG-011: a component that throws while rendering takes down everything above it
 * up to the nearest boundary — and there was none, so one bad row blanked the app.
 * React only offers this as a class component.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    // A new resetKey (the admin or resident went elsewhere) clears the crash.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No error reporter is wired up yet; the console is where this is visible today.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    return this.state.error ? this.props.fallback(this.reset) : this.props.children;
  }
}

/**
 * The card a crashed screen shows (BUG-011). It says what happened without a stack
 * trace, reassures that nothing was lost — reads failing do not write — and offers the
 * two ways out: re-render this screen, or reload the app.
 */
export function CrashCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="animate-rise flex flex-col items-start gap-3 rounded-card border border-paper/55 bg-danger-ink/10 px-5 py-5 text-danger-ink shadow-hairline"
    >
      <p className="flex items-center gap-2.5 text-body font-extrabold">
        <Icon name="alert" size={20} strokeWidth={2} />
        Something went wrong
      </p>
      <p className="text-meta text-ink-muted">
        This screen hit an error and could not be shown. Nothing you saved has been lost.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <Icon name="refresh" size={16} strokeWidth={2.1} />
          Try again
        </Button>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
          Reload the app
        </Button>
      </div>
    </div>
  );
}

/** Whole-app fallback, for a crash outside any screen (the router, a provider). */
export function CrashScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-[22px]">
      <CrashCard onRetry={onRetry} />
    </main>
  );
}

/**
 * The app-wide last line of defence, keyed by path so the back button — or any
 * navigation — recovers from it, not only "Try again" or a reload (V2 round 2).
 * Must sit inside the router.
 */
export function RootErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} fallback={(reset) => <CrashScreen onRetry={reset} />}>
      {children}
    </ErrorBoundary>
  );
}
