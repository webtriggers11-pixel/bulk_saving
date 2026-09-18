/**
 * Offline-aware state helpers (BUG-004).
 *
 * TanStack Query v5's default `networkMode: 'online'` PAUSES work when the browser
 * is offline instead of failing it. The consequences are easy to miss and identical
 * everywhere:
 *
 * - a paused **query** has `fetchStatus === 'paused'`, `isError` false, `isLoading`
 *   false and no data — so a page that gates its error state on `isError` alone
 *   renders a header and nothing else;
 * - a paused **mutation** has `isPaused` true and `isPending` true, and nothing ever
 *   rejects — so a button that gates on `isPending` alone reads "Saving…" forever.
 *
 * These live in one place so the decision and the wording cannot drift across the
 * fifteen-odd controls that need them. A rejected promise does NOT reproduce either
 * case: that is the server-error path, which is why tests kept passing while this was
 * broken. Drive offline with `onlineManager.setOnline(false)`.
 */

/** The part of a query result these helpers need (keeps them trivially testable). */
export interface QueryLike {
  isError: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}

/**
 * True when a read has failed OR is paused because the browser is offline — i.e.
 * whenever the page should show its error/retry state rather than an empty body.
 */
export function queryStalled(query: QueryLike): boolean {
  return query.isError || query.fetchStatus === 'paused';
}

/**
 * True when there is data worth keeping on screen. An explicit length check, because
 * `Boolean([])` is true and an empty list would otherwise claim "showing what we
 * loaded earlier" while the empty-state card renders underneath it.
 */
export function hasRows<T>(data: T[] | undefined): boolean {
  return Array.isArray(data) && data.length > 0;
}

/**
 * Copy for a write that is queued because the browser is offline. Deliberately not
 * an error: a paused mutation resumes when the connection returns, so promising that
 * is honest, and calling it a failure would not be.
 */
export const OFFLINE_QUEUED_TEXT = "You're offline. We'll send this as soon as you reconnect.";

/** Button label while a write waits for a connection. */
export const OFFLINE_WAITING_LABEL = 'Waiting for a connection…';

/** True if any of the given mutations is paused waiting for a connection. */
export function anyPaused(...mutations: Array<{ isPaused: boolean }>): boolean {
  return mutations.some((m) => m.isPaused);
}
