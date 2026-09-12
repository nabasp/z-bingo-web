import { describe, expect, it } from 'vitest';
import type { Cell, PublicPlayer } from '../types';
import { BOARD_ACTIONS, describeBoardAction, type BoardActionContext } from './boardActions';

const SIZE = 3;

function context(overrides: Partial<BoardActionContext> = {}): BoardActionContext {
  const values = [1, 2, 4, 5, 9, 6, 7, 3, 8];
  const marked = [5]; // C2 only, so row 2 needs A2 and B2.
  const cells: Cell[] = values.map((value, index) => ({
    index,
    value,
    marked: marked.includes(index),
  }));
  const players: PublicPlayer[] = [
    { id: 'me', name: 'Siv', seat: 0, ready: true, connected: true, letters: 2 },
    { id: 'john', name: 'John', seat: 1, ready: true, connected: true, letters: 1 },
  ];
  return {
    cells,
    size: SIZE,
    cellIndex: 4, // B2
    players,
    myId: 'me',
    notation: 'chess',
    ...overrides,
  };
}

describe('BOARD_ACTIONS', () => {
  it('binds each action to a distinct key', () => {
    const keys = BOARD_ACTIONS.map(action => action.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('describeBoardAction', () => {
  it('reads the whole board for the pattern action', () => {
    expect(describeBoardAction('pattern', context())).toBe(
      'Row 1: 1, 2, 4. Row 2: 5, 9, 6. Row 3: 7, 3, 8.',
    );
  });

  it('answers row and column relative to where the cursor is', () => {
    expect(describeBoardAction('row', context())).toBe('Row 2 needs 2 cells: A2, B2.');
    expect(describeBoardAction('column', context())).toBe('Column B needs 3 cells: B1, B2, B3.');
  });

  it('follows the cursor to a different row', () => {
    expect(describeBoardAction('row', context({ cellIndex: 0 }))).toBe(
      'Row 1 needs 3 cells: A1, B1, C1.',
    );
  });

  it('answers the diagonals wherever the cursor is, there being one of each', () => {
    const fromCorner = context({ cellIndex: 0 });
    expect(describeBoardAction('diagonal', fromCorner)).toBe(
      describeBoardAction('diagonal', context()),
    );
    expect(describeBoardAction('antiDiagonal', context())).toBe(
      'Anti-diagonal needs 3 cells: C1, B2, A3.',
    );
  });

  it('reads the standings without needing a board at all', () => {
    // Asked from the lobby, before boards are dealt.
    expect(describeBoardAction('scores', context({ cells: [] }))).toBe(
      'You are 2 of 3. John is 1 of 3.',
    );
  });

  it('stays quiet about a board that has not been dealt', () => {
    expect(describeBoardAction('pattern', context({ cells: [] }))).toBeNull();
    expect(describeBoardAction('row', context({ cells: [] }))).toBeNull();
  });

  it('follows the player’s chosen notation', () => {
    expect(describeBoardAction('row', context({ notation: 'rowcol' }))).toBe(
      'Row 2 needs 2 cells: R2, C1. R2, C2.',
    );
  });
});
