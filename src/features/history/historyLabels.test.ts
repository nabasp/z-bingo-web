import { describe, expect, it } from 'vitest';
import {
  dateShort,
  dateSpoken,
  detailsPlayerLabel,
  detailsSummary,
  durationShort,
  durationSpoken,
  gameTitle,
  gameTitleSpoken,
  historyItemLabel,
  leaderboardEntryLabel,
  rankShort,
  rankSpoken,
  resultLine,
  resultWord,
  winRatePercent,
  winRateSpoken,
} from './historyLabels';
import type { GameDetails, HistoryItem, LeaderboardEntry } from './history.types';

/**
 * What a player hears.
 *
 * Asserted as whole sentences, because the order and the joins are the
 * accessibility decisions — a label that has every fact but reads "first
 * place, Won" sounds like a mistake.
 */

const UTC = { timeZone: 'UTC' };
// 6 October 2026, 20:14 UTC.
const ENDED = Date.UTC(2026, 9, 6, 20, 14);

function item(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'a82f0000-0000-4000-8000-000000000000',
    shortId: 'A82F',
    size: 5,
    startedAt: ENDED - 252_000,
    endedAt: ENDED,
    durationMs: 252_000,
    status: 'completed',
    result: 'won',
    rank: 1,
    playerCount: 3,
    winnerName: 'Ann',
    isWinner: true,
    ...overrides,
  };
}

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    rank: 1,
    displayName: 'Ann',
    gamesPlayed: 48,
    wins: 21,
    winRate: 0.4375,
    points: 125,
    isYou: false,
    ...overrides,
  };
}

describe('game titles', () => {
  it('reads the short id one character at a time', () => {
    expect(gameTitle('A82F')).toBe('Bingo #A82F');
    // "#A82F" aloud is "number A eighty-two F".
    expect(gameTitleSpoken('A82F')).toBe('Bingo game A 8 2 F');
  });
});

describe('results', () => {
  it('names every result in a word, so none depends on colour', () => {
    expect(resultWord('won')).toBe('Won');
    expect(resultWord('lost')).toBe('Lost');
    expect(resultWord('left')).toBe('Abandoned');
    expect(resultWord('cancelled')).toBe('Cancelled');
  });

  it('pairs the result with the place on screen', () => {
    expect(resultLine({ result: 'lost', rank: 2 })).toBe('Lost · 2nd');
    expect(resultLine({ result: 'cancelled', rank: null })).toBe('Cancelled');
  });
});

describe('ranks', () => {
  it('gets the English suffixes right, teens included', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(rankShort)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th',
      '21st', '22nd', '23rd', '101st', '111th',
    ]);
  });

  it('says a place as words aloud', () => {
    expect(rankSpoken(1)).toBe('first place');
    expect(rankSpoken(3)).toBe('third place');
  });

  it('says nothing about a place that does not exist', () => {
    expect(rankShort(null)).toBe('—');
    expect(rankSpoken(null)).toBeUndefined();
  });
});

describe('durations', () => {
  it('is compact on screen', () => {
    expect(durationShort(45_000)).toBe('45s');
    expect(durationShort(252_000)).toBe('4m 12s');
    expect(durationShort(3_780_000)).toBe('1h 3m');
  });

  it('is spelled out aloud', () => {
    expect(durationSpoken(1_000)).toBe('1 second');
    expect(durationSpoken(252_000)).toBe('4 minutes 12 seconds');
    expect(durationSpoken(3_660_000)).toBe('1 hour 1 minute');
  });

  it('never goes negative', () => {
    expect(durationShort(-5_000)).toBe('0s');
  });
});

describe('dates', () => {
  it('abbreviates the month on screen and spells it out aloud', () => {
    expect(dateShort(ENDED, UTC)).toBe('Oct 6, 2026');
    expect(dateSpoken(ENDED, UTC)).toBe('October 6, 2026');
  });
});

describe('win rates', () => {
  it('drops a trailing .0', () => {
    expect(winRatePercent(0.5)).toBe('50%');
    expect(winRatePercent(0.4375)).toBe('43.8%');
    expect(winRateSpoken(0.4375)).toBe('43.8 percent');
  });
});

describe('historyItemLabel', () => {
  it('leads with the result, then the detail', () => {
    expect(historyItemLabel(item(), UTC)).toBe(
      'Bingo game A 8 2 F. Won, first place. October 6, 2026. 3 players. Lasted 4 minutes 12 seconds',
    );
  });

  it('names the winner when it was somebody else', () => {
    expect(
      historyItemLabel(item({ result: 'lost', rank: 2, isWinner: false }), UTC),
    ).toContain('Lost, second place. Winner: Ann');
  });

  it('can lead with the visible title, for a link whose name must contain it', () => {
    expect(historyItemLabel(item(), { ...UTC, title: 'visible' })).toMatch(
      /^Bingo #A82F\. Won, first place\./,
    );
  });

  it('gives a cancelled game no place and no duration', () => {
    const label = historyItemLabel(
      item({ status: 'cancelled', result: 'cancelled', rank: null, winnerName: null, isWinner: false }),
      UTC,
    );
    expect(label).toBe('Bingo game A 8 2 F. Cancelled. October 6, 2026. 3 players');
  });
});

describe('game details', () => {
  const game: GameDetails = {
    id: 'x',
    shortId: 'A82F',
    size: 5,
    word: 'BINGO',
    startedAt: 0,
    endedAt: 1,
    durationMs: 1,
    status: 'completed',
    endReason: 'walkover',
    winnerName: 'Ann',
    players: [],
  };

  it('says how the game was decided', () => {
    expect(detailsSummary(game)).toBe('Ann won by walkover.');
    expect(detailsSummary({ ...game, endReason: 'bingo' })).toBe(
      'Ann won by completing the word.',
    );
    expect(detailsSummary({ ...game, status: 'cancelled', winnerName: null })).toBe(
      'This game was cancelled before anyone won.',
    );
  });

  it('marks the listener in the list of players', () => {
    expect(
      detailsPlayerLabel({
        name: 'Bob',
        seat: 1,
        letters: 2,
        rank: 2,
        result: 'lost',
        isYou: true,
        isWinner: false,
      }),
    ).toBe('second place, Bob, you. Lost. 2 letters');
  });
});

describe('leaderboardEntryLabel', () => {
  it('says what every number is', () => {
    expect(leaderboardEntryLabel(entry())).toBe(
      'Rank 1. Ann. 125 points. 48 games, 21 wins. 43.8 percent win rate',
    );
  });

  it('says "you" so a player can find themselves by ear', () => {
    expect(leaderboardEntryLabel(entry({ rank: 27, isYou: true }))).toContain(
      'Rank 27. Ann, you.',
    );
  });

  it('gets singulars right', () => {
    expect(
      leaderboardEntryLabel(entry({ points: 1, gamesPlayed: 1, wins: 0, winRate: 0 })),
    ).toBe('Rank 1. Ann. 1 point. 1 game, 0 wins. 0 percent win rate');
  });
});
