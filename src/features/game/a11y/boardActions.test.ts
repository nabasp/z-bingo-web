import { describe, expect, it } from 'vitest';
import type { Cell, PublicPlayer } from '../types';
import {
  actionsFor,
  BOARD_ACTIONS,
  describeAction,
  describeBoardAction,
  type BoardActionContext,
} from './boardActions';

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

  it('names the diagonals D and A, the pair a player has to hold together', () => {
    // A rather than X: the letter is the word, which is the only mnemonic
    // available to someone learning these by ear.
    expect(BOARD_ACTIONS.find(a => a.name === 'diagonal')?.key).toBe('D');
    expect(BOARD_ACTIONS.find(a => a.name === 'antiDiagonal')?.key).toBe('A');
  });

  it('keeps scores out of setup, where every score is zero', () => {
    expect(actionsFor('setup').map(a => a.name)).not.toContain('scores');
    expect(actionsFor('play').map(a => a.name)).toContain('scores');
  });

  it('gives every action a stage to live on', () => {
    for (const action of BOARD_ACTIONS) {
      expect(action.stages.length).toBeGreaterThan(0);
    }
  });

  it('describes the line readouts differently on the two stages', () => {
    // The key asks the same question; what counts as an answer does not.
    const row = BOARD_ACTIONS.find(a => a.name === 'row')!;
    expect(describeAction(row, 'setup')).toContain('blank');
    expect(describeAction(row, 'play')).toContain('strike');
  });
});

describe('describeBoardAction during setup', () => {
  /**
   * The bug this pins: a setup board has no marked cells, so asking about
   * marks answered "needs every cell" on every line of every board — true,
   * and useless to the person laying the board out.
   */
  function setupBoard(filled: number[]): Cell[] {
    return Array.from({ length: SIZE * SIZE }, (_, index) => ({
      index,
      value: filled.includes(index) ? index + 1 : null,
      marked: false,
    }));
  }

  it('answers about blank cells, not unmarked ones', () => {
    const cells = setupBoard([3, 5]);
    expect(
      describeBoardAction('row', context({ cells, basis: 'filled' })),
    ).toBe('Row 2 needs 1 cell: B2.');
  });

  it('calls a fully placed line complete', () => {
    const cells = setupBoard([3, 4, 5]);
    expect(
      describeBoardAction('row', context({ cells, basis: 'filled' })),
    ).toBe('Row 2 is complete.');
  });

  it('reads an unplaced board back as blank', () => {
    expect(
      describeBoardAction('pattern', context({ cells: setupBoard([]) })),
    ).toBe('Row 1: blank, blank, blank. Row 2: blank, blank, blank. Row 3: blank, blank, blank.');
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
