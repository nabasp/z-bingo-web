import { describe, expect, it } from 'vitest';
import type { Cell } from '../types';
import {
  isBoardComplete,
  makeEmptyBoard,
  nextAvailableNumber,
  shuffleFilledCells,
} from './index';

/**
 * Manual board filling.
 *
 * The board is built by choosing cells, and the number that lands is decided
 * for you — so the only way this can go wrong is by producing a duplicate or a
 * gap. Both are properties of `nextAvailableNumber` picking the lowest missing
 * number rather than counting upwards, which is what these tests pin.
 *
 * Shuffle is the other half: it must move numbers without ever inventing one,
 * because a board that gained a number nobody placed would be a different game
 * from the one the player thought they were setting up.
 */

/** Place numbers by choosing cells in the given order, as a player would. */
function place(size: 3 | 4 | 5, order: number[]): Cell[] {
  let cells = makeEmptyBoard(size);
  for (const index of order) {
    const value = nextAvailableNumber(cells, size);
    if (value === null) continue;
    cells = cells.map(cell => (cell.index === index ? { ...cell, value } : cell));
  }
  return cells;
}

/** Clear one cell, the way selecting a filled cell does. */
function clear(cells: Cell[], index: number): Cell[] {
  return cells.map(cell => (cell.index === index ? { ...cell, value: null } : cell));
}

describe('nextAvailableNumber', () => {
  it('starts at 1 on an empty board', () => {
    expect(nextAvailableNumber(makeEmptyBoard(3), 3)).toBe(1);
  });

  it('assigns in the order cells are chosen, not by position', () => {
    // The example from the spec: the order you pick decides the number, so
    // choosing the last cell first gives it 1.
    const cells = place(5, [0, 14, 6]);

    expect(cells[0].value).toBe(1);
    expect(cells[14].value).toBe(2);
    expect(cells[6].value).toBe(3);
  });

  it('returns null once the board is full', () => {
    const full = place(3, [0, 1, 2, 3, 4, 5, 6, 7, 8]);

    expect(isBoardComplete(full)).toBe(true);
    expect(nextAvailableNumber(full, 3)).toBeNull();
  });

  it('hands a cleared number straight back', () => {
    // The correction story: clear the wrong cell, choose the right one, and
    // the same number moves. No undo stack, no renumbering.
    const cells = clear(place(3, [0, 1, 2]), 1);

    expect(nextAvailableNumber(cells, 3)).toBe(2);
  });

  it('fills the lowest gap first when several are cleared', () => {
    let cells = place(3, [0, 1, 2, 3, 4]);
    cells = clear(clear(cells, 3), 1); // frees 4, then 2

    expect(nextAvailableNumber(cells, 3)).toBe(2);
  });

  it('never repeats a number, however the board is edited', () => {
    // The invariant that matters. Fill, clear a scattered handful, refill, and
    // the result must still be exactly 1..9 with nothing doubled.
    let cells = place(3, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (const index of [7, 2, 4, 0]) cells = clear(cells, index);
    for (const index of [4, 0, 7, 2]) {
      const value = nextAvailableNumber(cells, 3);
      cells = cells.map(cell =>
        cell.index === index ? { ...cell, value } : cell,
      );
    }

    const values = cells.map(cell => cell.value).sort((a, b) => Number(a) - Number(b));
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('shuffleFilledCells', () => {
  it('keeps exactly the numbers that were placed', () => {
    const before = place(3, [0, 4, 8]);
    const after = shuffleFilledCells(before, () => 0.5);

    const values = (cells: Cell[]) =>
      cells
        .map(cell => cell.value)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);

    expect(values(after)).toEqual(values(before));
  });

  it('invents nothing on a part-filled board', () => {
    // The old Shuffle generated a whole new board, which is precisely what a
    // manually-built board must never suffer.
    const after = shuffleFilledCells(place(3, [0, 4]), () => 0.5);

    expect(after.filter(cell => cell.value !== null)).toHaveLength(2);
  });

  it('leaves the empty cells exactly where they were', () => {
    // A player part-way through keeps their sense of the board's shape; only
    // the values move.
    const before = place(3, [0, 4, 8]);
    const after = shuffleFilledCells(before, () => 0.5);

    const holes = (cells: Cell[]) =>
      cells.filter(cell => cell.value === null).map(cell => cell.index);

    expect(holes(after)).toEqual(holes(before));
  });

  it('actually rearranges a full board', () => {
    const before = place(3, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // A reversing permutation, so the assertion cannot pass by luck.
    const after = shuffleFilledCells(before, () => 0);

    expect(after.map(cell => cell.value)).not.toEqual(before.map(cell => cell.value));
    expect([...after.map(cell => cell.value)].sort((a, b) => Number(a) - Number(b))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('does nothing to an empty board', () => {
    const empty = makeEmptyBoard(3);
    expect(shuffleFilledCells(empty, () => 0.5)).toEqual(empty);
  });
});
