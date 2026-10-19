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
    if ((typeof value === 'string' && value !== '') || typeof value === 'number') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface UrlFilters<K extends string> {
  /**
   * The filters that are set AND valid. An unset, empty or invalid param is absent —
   * `?category=Foo` must not reach the server while the "All" chip looks chosen, nor
   * light up "Clear filters" over a list that is not filtered (FEAT-015 V2 P2-2).
   */
  filters: Partial<Record<K, string>>;
  /** Merge a patch; `undefined` or '' removes a key. Replaces history — no entry per keystroke. */
  setFilters: (patch: Partial<Record<K, string | undefined>>) => void;
  /** Remove every key this screen owns, leaving anything else in the URL alone. */
  clear: () => void;
  /** How many filters are set — drives the "Clear filters" affordance. */
  activeCount: number;
  /** Bumped by `clear()` — hand it to useDebouncedSearch so a half-typed search dies too. */
  generation: number;
}

/** Per-key validity checks; a key with no check accepts any non-empty value. */
export type FilterValidators<K extends string> = Partial<Record<K, (value: string) => boolean>>;

export function useUrlFilters<K extends string>(
  keys: readonly K[],
  validators: FilterValidators<K> = {},
): UrlFilters<K> {
  const [params, setParams] = useSearchParams();
  const [generation, setGeneration] = useState(0);
  // Validators are module-level constants at every call site.
  const valid = useRef(validators);
  valid.current = validators;
  // Keys are a module-level constant at every call site; joined so a fresh array
  // literal does not invalidate the memo on every render.
  const keyList = keys.join(',');

  const filters = useMemo(() => {
    const out: Partial<Record<K, string>> = {};
    for (const key of keyList.split(',') as K[]) {
      const value = params.get(key);
      if (value && (valid.current[key]?.(value) ?? true)) {
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
    setGeneration((n) => n + 1);
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

  return { filters, setFilters, clear, activeCount: Object.keys(filters).length, generation };
}

/** `?status=` for services and vendors: only the two values the server accepts. */
export function isActiveFilter(value: string): boolean {
  return value === 'active' || value === 'inactive';
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
  /** `UrlFilters.generation`: when it changes, any half-typed text is dropped (V2 P2-5). */
  resetSignal = 0,
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

  // "Clear filters" while typing: the URL may not change at all (nothing was committed
  // yet), so the effect above never fires — and the pending text would commit a moment
  // after the admin cleared it. A clear always empties the box.
  const lastReset = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== lastReset.current) {
      lastReset.current = resetSignal;
      committed.current = '';
      setText('');
    }
  }, [resetSignal]);

  return [text, setText];
}
