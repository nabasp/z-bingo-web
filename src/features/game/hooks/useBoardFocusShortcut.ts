import { useRef, type RefObject } from 'react';
import { announcer, isSelfVoiceEnabled, SHORTCUTS, TIER, useShortcut } from '@/lib/a11y';

export interface BoardFocusShortcutOptions {
  /** The `id` given to the `BoardGrid`. */
  gridId: string;
  /**
   * Focused when the player leaves the board and whatever they came from is
   * gone — normally the page heading, which announces itself on focus.
   */
  fallbackRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

/**
 * Alt+B: jump to the board, and back again.
 *
 * The board is one tab stop but it sits behind everything above it on the page,
 * so reaching it by Tab means passing the banners every time. This is the way
 * back out as much as the way in: pressing it inside the board returns focus to
 * whatever the player was on before, which is what makes it safe to use — a
 * shortcut that strands you somewhere is one you learn not to press.
 *
 * A screen reader announces both moves for free: the cell speaks its own label
 * on focus and the restored element speaks its own name, so nothing is added
 * here for them. The app's own voice gets neither, which is why the landing
 * cell is spoken when — and only when — "Speak aloud" is on. It is read off
 * the cell's `aria-label`, so it is by construction the same sentence the
 * screen reader would have said.
 */
export function useBoardFocusShortcut({
  gridId,
  fallbackRef,
  enabled,
}: BoardFocusShortcutOptions): void {
  // Where to go back to. A ref, not state — nothing renders from it, and it
  // must survive re-renders caused by the game itself.
  const returnRef = useRef<HTMLElement | null>(null);

  useShortcut(
    SHORTCUTS.focusBoard.chord,
    () => {
      const grid = document.getElementById(gridId);
      if (!grid) {
        // Reachable between rounds, when the board has unmounted. Silence would
        // look like a broken key.
        announcer.speak('The board is not ready yet.', {
          ...TIER.interrupt,
          dedupeKey: 'shortcut-board',
        });
        return;
      }

      // `document.activeElement` is <body> when nothing is focused, never null.
      const active = document.activeElement as HTMLElement | null;

      if (grid.contains(active)) {
        const back = returnRef.current;
        returnRef.current = null;
        // The page re-renders constantly during play, so the element we came
        // from may be gone by now.
        const target = back?.isConnected ? back : fallbackRef.current;
        if (target) target.focus();
        else active?.blur();
        return;
      }

      returnRef.current = active && active !== document.body ? active : null;

      // The roving tabindex guarantees exactly one tabbable cell, and it is the
      // last one the player used — so reading it from the DOM restores their
      // position without this hook having to track it. The looser selector
      // covers a board that re-rendered mid-press.
      const cell =
        grid.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]') ??
        grid.querySelector<HTMLElement>('[role="gridcell"]');
      cell?.focus();

      if (cell && isSelfVoiceEnabled()) {
        const label = cell.getAttribute('aria-label');
        if (label) announcer.speak(label, TIER.interrupt);
      }
    },
    { enabled },
  );
}
