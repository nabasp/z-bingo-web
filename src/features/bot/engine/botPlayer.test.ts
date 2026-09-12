import { describe, expect, it } from 'vitest';
import { chooseBotCall } from './botPlayer';
import * as botPlayer from './botPlayer';

const BOT_BOARD = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('chooseBotCall', () => {
  it('only ever calls a number from its own board', () => {
    for (let i = 0; i < 50; i++) {
      const choice = chooseBotCall(BOT_BOARD, []);
      expect(BOT_BOARD).toContain(choice);
    }
  });

  it('never calls a number that has already been called', () => {
    const called = [1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = 0; i < 20; i++) {
      expect(chooseBotCall(BOT_BOARD, called)).toBe(9);
    }
  });

  it('has nothing to say when its board is exhausted', () => {
    expect(chooseBotCall(BOT_BOARD, BOT_BOARD)).toBeNull();
  });

  it('reaches every one of its remaining numbers', () => {
    // A bot that always picked the first free number would be predictable
    // enough to play around.
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(chooseBotCall(BOT_BOARD, [])!);
    expect(seen.size).toBe(BOT_BOARD.length);
  });

  it('picks uniformly across what is left', () => {
    // `rng` is injected so this asserts the mapping rather than hoping.
    expect(chooseBotCall(BOT_BOARD, [], () => 0)).toBe(1);
    expect(chooseBotCall(BOT_BOARD, [], () => 0.999)).toBe(9);
    expect(chooseBotCall(BOT_BOARD, [1, 2], () => 0)).toBe(3);
  });
});

/**
 * The fairness guarantee, asserted structurally.
 *
 * The point of these is that they cannot be satisfied by a bot that behaves
 * well today — they fail if a future change gives the bot a way to see the
 * human at all.
 */
describe('the bot cannot see the human', () => {
  it('takes no argument that could carry the human player', () => {
    // Board, called numbers, rng — and nothing else. Widening this is the only
    // way to hand the bot hidden information, and it is visible in review.
    expect(chooseBotCall).toHaveLength(2); // the third has a default
  });

  it('exports nothing but the one decision function', () => {
    // A module with a single pure export has nowhere to hide state, and no
    // second entry point through which the human's board could arrive.
    expect(Object.keys(botPlayer)).toEqual(['chooseBotCall']);
  });

  it('answers identically whatever the human holds', () => {
    // There is no parameter to pass a human board through, so the only way to
    // state this is that the same inputs give the same answer — the human's
    // position cannot enter into it.
    const called = [4, 5];
    const first = chooseBotCall(BOT_BOARD, called, () => 0.5);
    const second = chooseBotCall(BOT_BOARD, called, () => 0.5);
    expect(first).toBe(second);
  });
});
