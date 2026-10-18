import { useCallback, useEffect, useRef } from 'react';
import type { PagedList } from './usePagedList';

/**
 * After "Load more", put focus on the first row that arrived.
 *
 * Two reasons, and the first is a bug rather than a nicety:
 *
 * - When the *last* page loads, the "Load more" button is removed while it
 *   still has focus, and the browser drops focus to `<body>` — a screen-reader
 *   user is thrown back to the top of the page with no idea why.
 * - Otherwise the new rows arrive somewhere above the button, out of sight of
 *   anyone not looking, and the natural next thing to read is them.
 *
 * Returns a ref factory for the rows and a `loadMore` to use instead of the
 * list's own, which remembers where the new rows will start.
 */
export function useFocusOnLoadMore<T extends HTMLElement>(list: PagedList<unknown>) {
  const rows = useRef(new Map<number, T>());
  const firstNew = useRef<number | null>(null);

  const refFor = useCallback(
    (index: number) => (element: T | null) => {
      if (element) rows.current.set(index, element);
      else rows.current.delete(index);
    },
    [],
  );

  const { loadMore: load, items, loadingMore } = list;
  const loadMore = useCallback(() => {
    firstNew.current = items.length;
    load();
  }, [items.length, load]);

  useEffect(() => {
    if (loadingMore || firstNew.current === null) return;
    const from = firstNew.current;
    if (items.length <= from) return;
    firstNew.current = null;
    rows.current.get(from)?.focus();
  }, [items.length, loadingMore]);

  return { refFor, loadMore };
}
