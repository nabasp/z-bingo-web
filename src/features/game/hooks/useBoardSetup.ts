/**
 * Ported from `bingo/src/features/game/hooks/useBoardSetup.ts`.
 * Same logic and same public shape; only import paths differ, and the spoken
 * confirmations below are web-only — mobile speaks through the cell's own
 * accessibility label instead.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { announcer, TIER } from '@/lib/a11y/Announcer';
import { getNotation } from '@/lib/a11y/notation';
import { sentence } from '@/lib/a11y/phrases';
import { audioManager } from '@/lib/audio/AudioManager';
import { cellLabel } from '../a11y/cellLabel';
import type { BoardSize, Cell } from '../types';
import {
  fillRemainingCells,
  isBoardComplete,
  makeEmptyBoard,
  nextAvailableNumber,
  shuffleFilledCells,
} from '../utils';
import { useGameSocket } from '../context';

/**
 * How many board states undo remembers.
 *
 * Deep enough to cover a run of mistaken presses, shallow enough that it is
 * never a way to rebuild a board from the start — that is what clearing cells
 * is for.
 */
const HISTORY_LIMIT = 30;

/**
 * Board Setup: a purely local draft until it is submitted.
 *
 * The player builds the board by hand. It starts empty, and each selection of
 * an empty cell drops the next number into it — the *order you choose cells* is
 * what decides the arrangement, so nothing has to be typed. Selecting a filled
 * cell empties it again, and its number returns to the pool.
 *
 * That pairing is the correction story for a single cell, and it is why the
 * next number is always the lowest one missing: no sequence of presses can
 * produce a duplicate or a gap in the final board. `undo` covers what that
 * pairing cannot — the presses that move several cells at once, `shuffle` and
 * `fillRandom`, which a player who cannot see the board has no other way to
 * take back.
 *
 * `fillRandom` is the one concession to effort. Placing every cell by hand is
 * the point on a 3×3 and a chore on an 8×8 — sixty-four deliberate presses, and
 * as many swipes for a screen-reader user. It fills *around* what is already
 * placed rather than dealing a fresh board, so it stays an escape hatch rather
 * than a replacement for laying one out: the board still starts empty, and
 * nothing the player chose is moved.
 *
 * The server still deals a board on join; it is deliberately ignored here, and
 * whatever is submitted replaces it. The server re-validates on submit
 * regardless.
 */
export function useBoardSetup(size: BoardSize) {
  const { submitBoard, me } = useGameSocket();
  const [cells, setCells] = useState<Cell[]>(() => makeEmptyBoard(size));

  /**
   * Previous board states, oldest first.
   *
   * State rather than a ref because the Undo button's disabled styling reads
   * from it, and a ref would leave the button looking available on an empty
   * history.
   */
  const [history, setHistory] = useState<Cell[][]>([]);

  /**
   * Start over when the host changes the board size.
   *
   * Keyed on the size alone. The previous version adopted the server's dealt
   * board here; now that the board is built by hand there is nothing to adopt,
   * and reacting to every snapshot would wipe a half-finished board on any
   * unrelated room event.
   */
  const syncedTo = useRef(size);
  useEffect(() => {
    if (syncedTo.current === size) return;
    syncedTo.current = size;
    setCells(makeEmptyBoard(size));
    // A board of a different shape is not something the old history can be
    // applied to, so it goes with it.
    setHistory([]);
  }, [size]);

  /** The server marks a player `ready` once their board is locked in. */
  const submitted = me?.ready ?? false;

  /** Placed next, and shown in the instructions so it is never a surprise. */
  const nextNumber = useMemo(() => nextAvailableNumber(cells, size), [cells, size]);

  const isComplete = isBoardComplete(cells);

  /**
   * One cell, worded exactly as the cursor words it.
   *
   * Reusing `cellLabel` is what keeps "B2, 9, filled" from drifting away from
   * what the same cell says when you arrow onto it.
   */
  const describeCell = (board: Cell[], index: number): string => {
    const cell = board[index];
    if (!cell) return '';
    return cellLabel({
      index,
      size,
      value: cell.value,
      variant: 'setup',
      marked: false,
      selected: false,
      inCompletedLine: false,
      notation: getNotation(),
    });
  };

  /** Record the board about to be replaced, so `undo` can put it back. */
  const commit = (next: Cell[]) => {
    setHistory(prev => [...prev, cells].slice(-HISTORY_LIMIT));
    setCells(next);
  };

  // Purely local board edits, so nothing reaches the server to diff against —
  // these cues are played here rather than by the snapshot bridge.
  const shuffle = () => {
    if (submitted) {
      audioManager.play('board_invalid');
      return;
    }
    commit(shuffleFilledCells(cells));
    audioManager.play('board_shuffled');
    announcer.speak('Numbers shuffled.', { ...TIER.interrupt, dedupeMs: 0 });
  };

  /** Drop the remaining numbers into the remaining cells, at random. */
  const fillRandom = () => {
    if (submitted || isComplete) {
      audioManager.play('board_invalid');
      return;
    }
    commit(fillRemainingCells(cells, size));
    audioManager.play('board_shuffled');
    announcer.speak('Cells are filled with random numbers.', {
      ...TIER.interrupt,
      dedupeMs: 0,
    });
  };

  /**
   * Put the board back one step.
   *
   * Silence on an exhausted history would be indistinguishable from a dropped
   * keypress, so it says so instead. When exactly one cell moved it is named,
   * because after a single press that is the only thing the player wants to
   * know; after a shuffle or a fill, naming one of sixty-four would mislead.
   */
  const undo = () => {
    if (submitted) {
      audioManager.play('board_invalid');
      return;
    }

    const previous = history[history.length - 1];
    if (!previous) {
      audioManager.play('board_invalid');
      announcer.speak('Nothing to undo.', {
        ...TIER.interrupt,
        dedupeKey: 'undo-empty',
      });
      return;
    }

    const changed = previous.reduce<number[]>(
      (out, cell, index) =>
        cell.value === cells[index]?.value ? out : [...out, index],
      [],
    );

    setHistory(prev => prev.slice(0, -1));
    setCells(previous);
    audioManager.play('board_reset');
    announcer.speak(
      sentence(
        'Undo',
        changed.length === 1 ? describeCell(previous, changed[0]) : undefined,
      ),
      { ...TIER.interrupt, dedupeMs: 0 },
    );
  };

  const onCellPress = (cell: Cell) => {
    if (submitted) {
      audioManager.play('board_invalid');
      return;
    }

    // A filled cell empties, returning its number to the pool. This is the
    // only way to correct a mistake, and it is why `nextAvailableNumber` picks
    // the lowest missing number rather than counting upwards.
    if (cell.value !== null) {
      const next = [...cells];
      next[cell.index] = { ...next[cell.index], value: null };
      commit(next);
      audioManager.play('board_reset');
      announcer.speak(describeCell(next, cell.index), {
        ...TIER.interrupt,
        dedupeMs: 0,
      });
      return;
    }

    if (nextNumber === null) {
      audioManager.play('board_invalid');
      return;
    }

    const next = [...cells];
    next[cell.index] = { ...next[cell.index], value: nextNumber };
    commit(next);
    audioManager.play('cell_select');
    // The confirmation the spec asks for: "B2, 9, filled". Dedupe is off
    // because filling two cells with the same wording in quick succession is
    // routine, and the second one must not be swallowed.
    announcer.speak(describeCell(next, cell.index), {
      ...TIER.interrupt,
      dedupeMs: 0,
    });
  };

  /** Lock the board in. The server starts the game once everyone submits. */
  const submit = () => {
    if (!isComplete || submitted) return;
    submitBoard(cells.map(cell => cell.value as number));
    audioManager.play('board_submitted');
  };

  return {
    cells,
    /** The number the next empty cell will receive, or null when full. */
    nextNumber,
    /** How many cells still need a number. Drives the instructions. */
    remaining: cells.filter(cell => cell.value === null).length,
    shuffle,
    fillRandom,
    undo,
    /** Whether there is anything left to take back. Drives the Undo button. */
    canUndo: history.length > 0 && !submitted,
    onCellPress,
    isComplete,
    submitted,
    submit,
  };
}
