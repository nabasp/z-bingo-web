import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/apiClient';

export interface PageResult<T> {
  items: T[];
  nextCursor?: string;
}

export type ListStatus = 'loading' | 'ready' | 'error';

export interface PagedList<T> {
  items: T[];
  status: ListStatus;
  /** A user-facing sentence, or null. */
  error: string | null;
  hasMore: boolean;
  /** True while a further page is on its way; the list stays visible. */
  loadingMore: boolean;
  loadMore(): void;
  reload(): void;
}

/** The sentence to show for a failed request. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === 'network'
      ? 'Could not reach the server. Check your connection and try again.'
      : error.message;
  }
  return 'Something went wrong. Please try again.';
}

/** One stable empty array, so an empty list never changes identity. */
const NONE: never[] = [];

interface Loaded<T> {
  /** Which request this answers. Anything else is not current. */
  key: string;
  items: T[];
  cursor?: string;
  error: string | null;
}

/**
 * A server-paginated list.
 *
 * Pages are appended with a "Load more" control rather than loaded on scroll.
 * That is the accessibility choice: infinite scroll fetches on a gesture the
 * screen reader owns, and a list that grows by itself as you explore it moves
 * focus and loses your place. A button is something you choose to press.
 *
 * **Stale responses are dropped.** Every request is numbered, and a response
 * is only applied if it is still the latest — so switching the filter from
 * "Wins" to "Losses" while the first page of wins is in flight can never show
 * wins under the "Losses" heading.
 *
 * **"Loading" is derived, not set.** Each answer is stored with the key of the
 * request it answers; when `key` changes, what is stored no longer matches and
 * the list reads as loading until the new answer lands. Setting a loading flag
 * from an effect instead would render twice for every change.
 *
 * `fetchPage` is read through a ref so an inline function does not reload the
 * list on every render.
 */
export function usePagedList<T>(
  key: string,
  fetchPage: (cursor?: string) => Promise<PageResult<T>>,
): PagedList<T> {
  const [reloads, setReloads] = useState(0);
  const requestKey = `${key}\u0000${reloads}`;

  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const request = ++latest.current;
    fetchRef.current().then(
      page => {
        if (!mounted.current || request !== latest.current) return;
        setLoaded({ key: requestKey, items: page.items, cursor: page.nextCursor, error: null });
        setMoreError(null);
        // A "Load more" for the previous list was overtaken by this one.
        setLoadingMore(false);
      },
      failure => {
        if (!mounted.current || request !== latest.current) return;
        setLoaded({ key: requestKey, items: NONE, error: errorMessage(failure) });
        setLoadingMore(false);
      },
    );
  }, [requestKey]);

  const current = loaded?.key === requestKey ? loaded : null;
  const status: ListStatus = !current ? 'loading' : current.error ? 'error' : 'ready';
  const cursor = current?.cursor;

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore || status !== 'ready') return;
    const request = ++latest.current;
    const forKey = requestKey;
    setLoadingMore(true);
    setMoreError(null);

    fetchRef.current(cursor).then(
      page => {
        if (!mounted.current || request !== latest.current) return;
        setLoaded(previous =>
          previous && previous.key === forKey
            ? {
                ...previous,
                items: [...previous.items, ...page.items],
                cursor: page.nextCursor,
              }
            : previous,
        );
        setLoadingMore(false);
      },
      failure => {
        if (!mounted.current || request !== latest.current) return;
        // The list already shown stays; only the extra page failed.
        setMoreError(errorMessage(failure));
        setLoadingMore(false);
      },
    );
  }, [cursor, loadingMore, status, requestKey]);

  const reload = useCallback(() => setReloads(count => count + 1), []);

  return {
    items: current?.items ?? NONE,
    status,
    error: current?.error ?? moreError,
    hasMore: Boolean(cursor),
    loadingMore,
    loadMore,
    reload,
  };
}
