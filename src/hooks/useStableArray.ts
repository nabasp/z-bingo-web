/**
 * Ported verbatim from the React Native app: `bingo/src/hooks/useStableArray.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import { useRef } from 'react';

/*
 * The `react-hooks/refs` rule forbids touching a ref during render. This hook
 * is the deliberate exception it does not model: the ref is a pure memoization
 * cache, not state. Reading and writing it is idempotent, produces no visible
 * effect, and returning the cached array is the entire point — it is the same
 * shape as `useMemo`, which cannot be used here because the comparison is by
 * contents rather than by reference identity.
 */
/* eslint-disable react-hooks/refs */

/**
 * Keep a referentially stable array as long as its contents are unchanged.
 *
 * Every socket payload is freshly deserialised, so `room.calledNumbers` and
 * `room.yourBoard` are brand-new arrays on every snapshot even when nothing
 * about them changed. Passing those straight into `useMemo` deps means the
 * board and its completed lines are rebuilt on every server message.
 *
 * A shallow compare is O(n) over at most 64 numbers — far cheaper than the cell
 * rebuild plus line scan it prevents. The generic preserves the caller's exact
 * array type so no casting is needed at the call site.
 */
export function useStableArray<T extends readonly unknown[] | undefined>(
  next: T,
): T {
  const ref = useRef(next);
  const current = ref.current;

  const same =
    current === next ||
    (current !== undefined &&
      next !== undefined &&
      current.length === next.length &&
      current.every((value, i) => value === next[i]));

  if (!same) ref.current = next;
  return ref.current;
}
