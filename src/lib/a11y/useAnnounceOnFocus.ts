import { useEffect, useRef } from 'react';
import { announcer } from './Announcer';

/** Long enough for the new page to have painted before focus is moved. */
const FOCUS_DELAY_MS = 120;

export interface AnnounceOnFocusOptions {
  /** Spoken on arrival, e.g. "Game lobby". */
  title: string;
  /** Optional second sentence explaining what to do here. */
  detail?: string;
  /**
   * Re-announce when this changes while the page stays mounted. Use for
   * server-driven content that arrives after navigation.
   */
  key?: string;
}

/**
 * Announce a page on arrival, and park focus on its heading.
 *
 * **Why this is needed** — the same reason as on mobile
 * (`bingo/src/lib/a11y/useAnnounceOnFocus.ts`): `useGameFlowNavigation` changes
 * the route in response to *server* events, so a player can be moved from the
 * lobby to the board without having touched anything. A client-side route
 * change also moves no focus and reads no title by default, so without this the
 * page simply changes in silence and the keyboard user's focus is left on a
 * button that no longer exists.
 *
 * Returns a ref to attach to the element that should receive focus — normally
 * the page heading, which needs `tabIndex={-1}` to be programmatically
 * focusable.
 */
export function useAnnounceOnFocus<T extends HTMLElement = HTMLHeadingElement>({
  title,
  detail,
  key,
}: AnnounceOnFocusOptions) {
  const headingRef = useRef<T | null>(null);
  const lastAnnounced = useRef<string | null>(null);

  useEffect(() => {
    const signature = `${title}|${detail ?? ''}|${key ?? ''}`;
    if (lastAnnounced.current === signature) return;
    const isFirstForThisPage = lastAnnounced.current === null;
    lastAnnounced.current = signature;

    // Assertive: arriving somewhere new outranks whatever was being said about
    // the page we just left.
    announcer.speak(detail ? `${title}. ${detail}` : title, { assertive: true });

    // Only on arrival. Re-running on a `key` change would drag focus off
    // whatever the player is currently exploring every time the server pushes
    // an update.
    if (!isFirstForThisPage) return;

    const timer = setTimeout(() => {
      headingRef.current?.focus({ preventScroll: false });
    }, FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [title, detail, key]);

  // Leaving the page: anything queued about it is now stale.
  useEffect(() => () => announcer.clear(), []);

  return headingRef;
}
