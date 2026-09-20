import { useCallback } from 'react';
import { announcer, getNotation, TIER } from '@/lib/a11y';
import {
  describeBoardAction,
  type BoardActionName,
} from '../a11y/boardActions';
import type { LineBasis } from '../a11y/lineProgress';
import type { Cell, PublicPlayer } from '../types';

/**
 * Speaks the answer to a board readout.
 *
 * The wording lives in `describeBoardAction`, which is pure and shared with the
 * web app; this hook is only the part that cannot be — reading the live
 * preference and handing the sentence to the announcer.
 *
 * Everything here is `TIER.summary`: the player asked for it, so it interrupts
 * whatever was playing, is never suppressed as a duplicate (asking twice is a
 * reasonable thing to do), and is exempt from the batch length cap, because a
 * whole 8×8 board will not fit inside it.
 */
export interface BoardReadoutOptions {
  cells: Cell[];
  size: number;
  players: PublicPlayer[];
  myId: string | undefined;
  /**
   * What "still needed" means on this screen: a cell without a number during
   * setup, an unmarked one during play. Defaults to play, which is where the
   * readouts started.
   */
  basis?: LineBasis;
}

export function useBoardReadouts({
  cells,
  size,
  players,
  myId,
  basis = 'marked',
}: BoardReadoutOptions): (action: BoardActionName, cellIndex: number) => void {
  return useCallback(
    (action: BoardActionName, cellIndex: number) => {
      const text = describeBoardAction(action, {
        cells,
        size,
        cellIndex,
        players,
        myId,
        basis,
        // Read at answer time rather than subscribed to: this is not rendered,
        // so a subscription would only add a re-render to every board.
        notation: getNotation(),
      });

      // Silence would be indistinguishable from a missed gesture, so a board
      // that is not ready yet says so rather than saying nothing.
      announcer.speak(text ?? 'The board is not ready yet.', TIER.summary);
    },
    [cells, size, players, myId, basis],
  );
}
