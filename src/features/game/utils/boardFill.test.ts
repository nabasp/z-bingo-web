import { describe, expect, it } from 'vitest';
import type { Cell } from '../types';
import {
  fillRemainingCells,
  initials,
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

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('Siv Nabas')).toBe('SN');
    expect(initials('Siv')).toBe('S');
    expect(initials('Siv Kumar Nabas')).toBe('SK');
  });

  /**
   * The bot is named "🤖 Bot". `charAt(0)` returns half of that emoji's
   * surrogate pair, which rendered as a replacement glyph in its avatar — and
   * would do the same for any player whose name starts with an astral
   * character.
   */
  it('does not split an emoji in half', () => {
    expect(initials('🤖 Bot')).toBe('🤖B');
    expect(initials('🎲')).toBe('🎲');
  });

  it('is empty for an empty name rather than throwing', () => {
    expect(initials('')).toBe('');
    expect(initials('   ')).toBe('');
  });
});

describe('fillRemainingCells', () => {
  const SIZE = 3 as const;

  it('completes an empty board with every number exactly once', () => {
    const filled = fillRemainingCells(makeEmptyBoard(SIZE), SIZE);
    expect(filled.map(c => c.value).sort((a, b) => a! - b!)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  /**
   * The whole reason it fills rather than deals: a player who placed the few
   * cells they cared about must keep them exactly where they put them.
   */
  it('leaves the numbers already placed exactly where they are', () => {
    const board = makeEmptyBoard(SIZE);
    board[4] = { ...board[4], value: 1 };
    board[0] = { ...board[0], value: 7 };

    const filled = fillRemainingCells(board, SIZE);

    expect(filled[4].value).toBe(1);
    expect(filled[0].value).toBe(7);
  });

  it('fills only the empty cells, and fills all of them', () => {
    const board = makeEmptyBoard(SIZE);
    board[2] = { ...board[2], value: 5 };

    const filled = fillRemainingCells(board, SIZE);

    expect(filled.every(c => c.value !== null)).toBe(true);
    expect(new Set(filled.map(c => c.value)).size).toBe(9);
  });

  it('never invents a duplicate', () => {
    for (let run = 0; run < 30; run++) {
      const values = fillRemainingCells(makeEmptyBoard(4), 4).map(c => c.value);
      expect(new Set(values).size).toBe(16);
    }
  });

  it('is a no-op on a board that is already full', () => {
    const full = fillRemainingCells(makeEmptyBoard(SIZE), SIZE);
    expect(fillRemainingCells(full, SIZE).map(c => c.value)).toEqual(
      full.map(c => c.value),
    );
  });

  it('places the missing numbers in the order the rng gives', () => {
    // Injectable so this asserts the arrangement rather than hoping for one.
    const board = makeEmptyBoard(SIZE);
    const filled = fillRemainingCells(board, SIZE, () => 0);
    expect(filled.map(c => c.value)).toHaveLength(9);
    expect(new Set(filled.map(c => c.value)).size).toBe(9);
  });

  it('varies between runs, so it is not a fixed layout', () => {
    const seen = new Set(
      Array.from({ length: 20 }, () =>
        fillRemainingCells(makeEmptyBoard(4), 4)
          .map(c => c.value)
          .join(','),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});
