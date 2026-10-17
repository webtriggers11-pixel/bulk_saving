import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * FEAT-015 (ADR-0026): list filters live in the URL. A refresh keeps them, a link
 * shares them, and the query key is derived from them — so there is one source.
 */

/** `{ q: 'tank', status: undefined }` → `?q=tank`. Empty values are left out. */
export function toQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value !== '') {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface UrlFilters<K extends string> {
  /** The filters that are set (an unset or empty param is absent, never ''). */
  filters: Partial<Record<K, string>>;
  /** Merge a patch; `undefined` or '' removes a key. Replaces history — no entry per keystroke. */
  setFilters: (patch: Partial<Record<K, string | undefined>>) => void;
  /** Remove every key this screen owns, leaving anything else in the URL alone. */
  clear: () => void;
  /** How many filters are set — drives the "Clear filters" affordance. */
  activeCount: number;
}

export function useUrlFilters<K extends string>(keys: readonly K[]): UrlFilters<K> {
  const [params, setParams] = useSearchParams();
  // Keys are a module-level constant at every call site; joined so a fresh array
  // literal does not invalidate the memo on every render.
  const keyList = keys.join(',');

  const filters = useMemo(() => {
    const out: Partial<Record<K, string>> = {};
    for (const key of keyList.split(',') as K[]) {
      const value = params.get(key);
      if (value) {
        out[key] = value;
      }
    }
    return out;
  }, [params, keyList]);

  const setFilters = useCallback(
    (patch: Partial<Record<K, string | undefined>>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch) as Array<[string, string | undefined]>) {
            if (value) {
              next.set(key, value);
            } else {
              next.delete(key);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of keyList.split(',')) {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }, [setParams, keyList]);

  return { filters, setFilters, clear, activeCount: Object.keys(filters).length };
}

/** How long typing must pause before a search reaches the URL (and so the server). */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * The text in a search box, kept in step with a URL param without fighting the typist.
 *
 * The box updates on every keystroke; the URL (and the request) only once typing pauses.
 * When the URL changes for some OTHER reason — "Clear filters", the back button — the
 * box adopts it. Telling those apart is the whole job: a commit we made ourselves comes
 * back as a URL change too, and adopting it would overwrite letters typed since.
 */
export function useDebouncedSearch(
  urlValue: string | undefined,
  commit: (value: string | undefined) => void,
  delay = SEARCH_DEBOUNCE_MS,
): [string, (value: string) => void] {
  const [text, setText] = useState(urlValue ?? '');
  const committed = useRef(urlValue ?? '');
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = text.trim();
      if (next !== committed.current) {
        committed.current = next;
        commitRef.current(next || undefined);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  useEffect(() => {
    const external = urlValue ?? '';
    if (external !== committed.current) {
      committed.current = external;
      setText(external);
    }
  }, [urlValue]);

  return [text, setText];
}
