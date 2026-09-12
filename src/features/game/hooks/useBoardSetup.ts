/**
 * Ported from `bingo/src/features/game/hooks/useBoardSetup.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { audioManager } from '@/lib/audio/AudioManager';
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
 * Board Setup: a purely local draft until it is submitted.
 *
 * The player builds the board by hand. It starts empty, and each selection of
 * an empty cell drops the next number into it — the *order you choose cells* is
 * what decides the arrangement, so nothing has to be typed. Selecting a filled
 * cell empties it again, and its number returns to the pool.
 *
 * That pairing is the whole correction story, and it is why there is no undo
 * button: because the next number is always the lowest one missing, clearing a
 * cell and choosing another moves a number, and no sequence of presses can
 * produce a duplicate or a gap in the final board.
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
  }, [size]);

  /** The server marks a player `ready` once their board is locked in. */
  const submitted = me?.ready ?? false;

  /** Placed next, and shown in the instructions so it is never a surprise. */
  const nextNumber = useMemo(() => nextAvailableNumber(cells, size), [cells, size]);

  // Purely local board edits, so nothing reaches the server to diff against —
  // these cues are played here rather than by the snapshot bridge.
  const shuffle = () => {
    setCells(prev => shuffleFilledCells(prev));
    audioManager.play('board_shuffled');
  };

  /** Drop the remaining numbers into the remaining cells, at random. */
  const fillRandom = () => {
    if (submitted || isComplete) {
      audioManager.play('board_invalid');
      return;
    }
    setCells(prev => fillRemainingCells(prev, size));
    audioManager.play('board_shuffled');
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
      setCells(prev => {
        const next = [...prev];
        next[cell.index] = { ...next[cell.index], value: null };
        return next;
      });
      audioManager.play('board_reset');
      return;
    }

    if (nextNumber === null) {
      audioManager.play('board_invalid');
      return;
    }

    setCells(prev => {
      const next = [...prev];
      next[cell.index] = { ...next[cell.index], value: nextNumber };
      return next;
    });
    audioManager.play('cell_select');
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
    /** The number the next empty cell will receive, or null when full. */
    nextNumber,
    /** How many cells still need a number. Drives the instructions. */
    remaining: cells.filter(cell => cell.value === null).length,
    shuffle,
    fillRandom,
    onCellPress,
    isComplete,
    submitted,
    submit,
  };
}
