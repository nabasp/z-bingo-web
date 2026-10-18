import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, type ListStatus } from './usePagedList';

export interface RequestState<T> {
  data: T | null;
  status: ListStatus;
  error: string | null;
  /** Fetch again, showing the loading state. */
  reload(): void;
  /**
   * Fetch again behind what is already shown.
   *
   * For a screen returning to focus: Home after a game should pick up the
   * game just played, but should not flash back to a spinner — and announce
   * "loading" — every time the player comes back to it. A failure here keeps
   * the data already on screen rather than replacing it with an error.
   */
  refresh(): void;
}

interface Loaded<T> {
  /** Which request this answers. Anything else is not current. */
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * One request, its result, and a way to try again.
 *
 * Same rules as `usePagedList`: a stale answer is dropped — opening a second
 * game before the first loaded never shows the first under the second's
 * title — and "loading" is derived from whether the stored answer belongs to
 * the current request, rather than set from an effect.
 */
export function useRequest<T>(key: string, fetch: () => Promise<T>): RequestState<T> {
  const [reloads, setReloads] = useState(0);
  const requestKey = `${key}\u0000${reloads}`;
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);

  const fetchRef = useRef(fetch);
  const keyRef = useRef(requestKey);
  useEffect(() => {
    fetchRef.current = fetch;
    keyRef.current = requestKey;
  });

  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback((forKey: string, silent: boolean) => {
    const request = ++latest.current;
    fetchRef.current().then(
      value => {
        if (!mounted.current || request !== latest.current) return;
        setLoaded({ key: forKey, data: value, error: null });
      },
      failure => {
        if (!mounted.current || request !== latest.current) return;
        // A silent refresh that fails keeps what is already on screen — but
        // if nothing is, the failure still has to be said.
        setLoaded(previous =>
          silent && previous?.key === forKey
            ? previous
            : { key: forKey, data: null, error: errorMessage(failure) },
        );
      },
    );
  }, []);

  useEffect(() => {
    run(requestKey, false);
  }, [requestKey, run]);

  const current = loaded?.key === requestKey ? loaded : null;
  const status: ListStatus = !current ? 'loading' : current.error ? 'error' : 'ready';

  const reload = useCallback(() => setReloads(count => count + 1), []);
  // Stable, so a focus effect that depends on it does not re-run — and
  // re-fetch — every time the request key moves on.
  const refresh = useCallback(() => run(keyRef.current, true), [run]);

  return {
    data: current?.data ?? null,
    status,
    error: current?.error ?? null,
    reload,
    refresh,
  };
}
