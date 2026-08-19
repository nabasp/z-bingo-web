/**
 * Ported from `bingo/src/features/game/hooks/useBoardSetup.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useEffect, useRef, useState } from 'react';
import { audioManager } from '@/lib/audio/AudioManager';
import type { BoardSize, Cell } from '../types';
import {
  isBoardComplete,
  makeEmptyBoard,
  makeFilledBoard,
  toCells,
} from '../utils';
import { useGameSocket } from '../context';

/**
 * Board Setup: a purely local draft until it is submitted.
 *
 * The draft starts from the board the server dealt on join, so setup opens on a
 * playable arrangement — a player happy with theirs can submit immediately.
 * Shuffle and swapping both preserve the permutation, so the draft stays valid;
 * the server re-validates on submit regardless.
 */
export function useBoardSetup(size: BoardSize) {
  const { submitBoard, me, room } = useGameSocket();
  const dealt = room?.yourBoard;
  const [cells, setCells] = useState<Cell[]>(() =>
    dealt ? toCells(dealt, []) : makeEmptyBoard(size),
  );
  const [selected, setSelected] = useState<number | null>(null);

  /**
   * Adopt the server's board whenever it actually changes — on arrival, and
   * again when the host changes the size and everyone is re-dealt.
   *
   * Keyed on the contents rather than the array identity: a snapshot arrives on
   * every room event and would otherwise wipe a half-finished set of swaps.
   */
  // Seeded with what `useState` already adopted above, so mounting does not
  // immediately re-set every cell and re-render the whole grid.
  const syncedTo = useRef<string | null>(dealt ? dealt.join(',') : null);
  useEffect(() => {
    if (!dealt) return;
    const key = dealt.join(',');
    if (syncedTo.current === key) return;
    syncedTo.current = key;
    setSelected(null);
    setCells(toCells(dealt, []));
  }, [dealt]);

  /** The server marks a player `ready` once their board is locked in. */
  const submitted = me?.ready ?? false;

  // Purely local board edits, so nothing reaches the server to diff against —
  // these two cues are played here rather than by the snapshot bridge.
  const randomFill = () => {
    setSelected(null);
    setCells(makeFilledBoard(size));
    audioManager.play('board_shuffled');
  };

  const shuffle = randomFill;

  const reset = () => {
    setSelected(null);
    setCells(makeEmptyBoard(size));
    audioManager.play('board_reset');
  };

  const onCellPress = (cell: Cell) => {
    // A tap on an empty cell, or any tap once the board is locked, does
    // nothing — say so rather than swallowing it silently.
    if (submitted || cell.value === null) {
      audioManager.play('board_invalid');
      return;
    }
    if (selected === null) {
      setSelected(cell.index);
      audioManager.play('cell_select');
      return;
    }
    if (selected === cell.index) {
      setSelected(null);
      audioManager.play('cell_select');
      return;
    }
    setCells(prev => {
      const next = [...prev];
      const a = next[selected];
      const b = next[cell.index];
      next[selected] = { ...a, value: b.value };
      next[cell.index] = { ...b, value: a.value };
      return next;
    });
    setSelected(null);
    audioManager.play('cell_swap');
  };

  const isComplete = isBoardComplete(cells);

  /** Lock the board in. The server starts the game once everyone submits. */
  const submit = () => {
    if (!isComplete || submitted) return;
    submitBoard(cells.map(cell => cell.value as number));
    audioManager.play('board_submitted');
  };

  return {
    cells,
    /** Exactly one cell can be picked, so this is a plain index, not a set. */
    selectedIndex: selected,
    randomFill,
    shuffle,
    reset,
    onCellPress,
    isComplete,
    submitted,
    submit,
  };
}
