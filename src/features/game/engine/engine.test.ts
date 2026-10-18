import { describe, expect, it } from 'vitest';
import type { ScorablePlayer } from './index';
import {
  buildResults,
  evaluate,
  findWinner,
  generateDistinctBoard,
  isCallable,
  lettersOf,
  nextSeat,
  wordForSize,
} from './index';

const SIZE = 3;
/** 1..9 in reading order, so row 1 is 1, 2, 3 and the main diagonal is 1, 5, 9. */
const BOARD = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('wordForSize', () => {
  it('gives every board size its own word', () => {
    expect(wordForSize(3)).toBe('BUS');
    expect(wordForSize(5)).toBe('BINGO');
    expect(wordForSize(8)).toBe('CHAMPION');
  });

  it('is always exactly as long as the board is wide', () => {
    for (const size of [3, 4, 5, 6, 7, 8]) {
      expect(wordForSize(size)).toHaveLength(size);
    }
  });

  it('falls back rather than returning nothing for an unknown size', () => {
    expect(wordForSize(99)).toBe('BINGO');
  });
});

describe('evaluate', () => {
  it('finds a completed row', () => {
    const scored = evaluate(BOARD, new Set([1, 2, 3]), SIZE);
    expect(scored.completedLines).toHaveLength(1);
    expect(scored.letters).toBe(1);
    expect(scored.won).toBe(false);
  });

  it('needs as many lines as the board is wide to win', () => {
    // Rows 1 and 2 plus column 1 is three lines on a 3×3.
    const scored = evaluate(BOARD, new Set([1, 2, 3, 4, 5, 6, 7]), SIZE);
    expect(scored.completedLines.length).toBeGreaterThanOrEqual(SIZE);
    expect(scored.won).toBe(true);
  });

  it('caps letters at the board size, however many lines land', () => {
    const scored = evaluate(BOARD, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]), SIZE);
    // A full board completes all 8 lines; the word only has 3 letters.
    expect(scored.completedLines).toHaveLength(8);
    expect(scored.letters).toBe(SIZE);
  });

  it('scores an untouched board at nothing', () => {
    expect(evaluate(BOARD, new Set(), SIZE).letters).toBe(0);
  });
});

describe('lettersOf', () => {
  it('scores a board against the call list', () => {
    expect(lettersOf(BOARD, [1, 2, 3], SIZE)).toBe(1);
  });

  it('is zero for a player with no board yet', () => {
    expect(lettersOf(undefined, [1, 2, 3], SIZE)).toBe(0);
  });
});

describe('findWinner', () => {
  const players = (): ScorablePlayer[] => [
    { id: 'me', name: 'You', seat: 0, board: BOARD },
    { id: 'bot', name: 'Bot', seat: 1, board: [...BOARD].reverse() },
  ];

  it('is null while nobody has finished', () => {
    expect(findWinner(players(), [1, 2, 3], SIZE, 'me')).toBeNull();
  });

  /**
   * The tie-break is a rule, not a detail: every board holds all of 1..n², so
   * one call routinely finishes the last line for more than one player.
   */
  it('gives a shared finish to whoever made the call', () => {
    const called = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(findWinner(players(), called, SIZE, 'bot')?.winnerId).toBe('bot');
    expect(findWinner(players(), called, SIZE, 'me')?.winnerId).toBe('me');
  });

  it('falls back to the lowest seat when the caller did not finish', () => {
    const called = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(findWinner(players(), called, SIZE, 'nobody')?.winnerId).toBe('me');
  });

  it('carries the full standings, which the result screen reads', () => {
    const outcome = findWinner(players(), [1, 2, 3, 4, 5, 6, 7, 8, 9], SIZE, 'me');
    expect(outcome?.results).toHaveLength(2);
    expect(outcome?.results[0].lines.length).toBeGreaterThan(0);
  });
});

describe('buildResults', () => {
  it('orders by seat, not by score', () => {
    const results = buildResults(
      [
        { id: 'bot', name: 'Bot', seat: 1, board: BOARD },
        { id: 'me', name: 'You', seat: 0, board: BOARD },
      ],
      [1, 2, 3],
      SIZE,
    );
    expect(results.map(r => r.playerId)).toEqual(['me', 'bot']);
  });
});

describe('nextSeat', () => {
  it('moves clockwise', () => {
    expect(nextSeat([0, 1], 0)).toBe(1);
  });

  it('wraps back to the start', () => {
    expect(nextSeat([0, 1], 1)).toBe(0);
  });

  it('leaves a lone seat where it is rather than going undefined', () => {
    expect(nextSeat([0], 0)).toBe(0);
  });
});

describe('generateDistinctBoard', () => {
  it('deals a full permutation of 1 to n squared', () => {
    const board = generateDistinctBoard(5, []);
    expect([...board].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
  });

  it('avoids a board somebody already holds', () => {
    // Two identical boards would mark in lockstep and complete every line on
    // the same turn, which makes the game a coin flip on who calls first.
    const board = generateDistinctBoard(4, [BOARD]);
    expect(board.join(',')).not.toBe(BOARD.join(','));
  });
});

describe('isCallable', () => {
  it('accepts any number on the board', () => {
    expect(isCallable(1, SIZE)).toBe(true);
    expect(isCallable(9, SIZE)).toBe(true);
  });

  it('rejects anything off it', () => {
    expect(isCallable(0, SIZE)).toBe(false);
    expect(isCallable(10, SIZE)).toBe(false);
    expect(isCallable(1.5, SIZE)).toBe(false);
  });
});
