import { describe, expect, it } from 'vitest';
import type { Cell, PublicPlayer } from '../types';
import {
  describeBoard,
  describeLastCall,
  describePlayerCount,
  describeScores,
} from './boardReadout';

const SIZE = 3;

function board(values: Array<number | null>): Cell[] {
  return values.map((value, index) => ({ index, value, marked: false }));
}

function player(
  id: string,
  name: string,
  seat: number,
  letters: number,
): PublicPlayer {
  return { id, name, seat, ready: true, connected: true, letters };
}

describe('describeBoard', () => {
  it('reads the board a row at a time, which is what makes it memorable', () => {
    expect(describeBoard(board([1, 2, 4, 5, 9, 6, 7, 3, 8]), SIZE, 'chess')).toBe(
      'Row 1: 1, 2, 4. Row 2: 5, 9, 6. Row 3: 7, 3, 8.',
    );
  });

  it('says "blank" for an unplaced cell, as heard during board setup', () => {
    expect(describeBoard(board([1, null, null, null, null, null, null, null, null]), SIZE, 'chess'))
      .toBe('Row 1: 1, blank, blank. Row 2: blank, blank, blank. Row 3: blank, blank, blank.');
  });

  it('reads every row of the largest board without truncating', () => {
    const cells = board(Array.from({ length: 64 }, (_, i) => i + 1));
    const text = describeBoard(cells, 8, 'chess');
    expect(text).toContain('Row 8: 57, 58, 59, 60, 61, 62, 63, 64.');
    // Well past the announcer's 300-character batch cap — this is the string
    // `allowLong` exists for.
    expect(text.length).toBeGreaterThan(300);
  });
});

describe('describeScores', () => {
  const players = [
    player('me', 'Siv', 0, 2),
    player('capex', 'Capex', 1, 2),
    player('john', 'John', 2, 1),
  ];

  it('puts the listener first in their own voice', () => {
    expect(describeScores(players, SIZE, 'me')).toBe(
      'You are 2 of 3. Capex is 2 of 3. John is 1 of 3.',
    );
  });

  it('reads in seat order, not rank, so the list stays put between calls', () => {
    const shuffled = [players[2], players[0], players[1]];
    expect(describeScores(shuffled, SIZE, 'me')).toBe(
      'You are 2 of 3. Capex is 2 of 3. John is 1 of 3.',
    );
  });

  it('names everyone in the third person when the listener is not playing', () => {
    expect(describeScores(players, SIZE, undefined)).toBe(
      'Siv is 2 of 3. Capex is 2 of 3. John is 1 of 3.',
    );
  });

  it('says so rather than going silent in an empty room', () => {
    expect(describeScores([], SIZE, 'me')).toBe('No players yet.');
  });
});

describe('describePlayerCount', () => {
  it('pluralises', () => {
    expect(describePlayerCount(1)).toBe('1 player');
    expect(describePlayerCount(3)).toBe('3 players');
  });
});

describe('describeLastCall', () => {
  const cells = board([1, 2, 4, 5, 9, 6, 7, 3, 8]);
  const players = [player('me', 'Siv', 0, 0), player('john', 'John', 1, 0)];

  function last(call: { number: number; playerId: string } | undefined) {
    return describeLastCall({
      call,
      players,
      cells,
      size: SIZE,
      myId: 'me',
      notation: 'chess',
    });
  }

  it('says where it landed, what it was, and who called it', () => {
    expect(last({ number: 9, playerId: 'john' })).toBe(
      'Last call: B2, 9, called by John.',
    );
  });

  it('marks it as a replay, not a new call', () => {
    // Without this a recall is indistinguishable from a number being called
    // right now, which on a running turn clock is the difference between
    // acting and losing your turn.
    expect(last({ number: 9, playerId: 'john' })).toMatch(/^Last call: /);
  });

  it('leaves the cell out for a number that is not on your board', () => {
    expect(last({ number: 42, playerId: 'john' })).toBe(
      'Last call: 42, called by John. Not on your board.',
    );
  });

  it('reads as prose about your own call rather than naming you', () => {
    expect(last({ number: 9, playerId: 'me' })).toBe(
      'Last call: B2, 9, called by you.',
    );
  });

  it('says so rather than going silent before the first call', () => {
    expect(last(undefined)).toBe('Nothing has been called yet.');
  });

  it('follows the coordinate vocabulary', () => {
    expect(
      describeLastCall({
        call: { number: 9, playerId: 'john' },
        players,
        cells,
        size: SIZE,
        myId: 'me',
        notation: 'rowcol',
      }),
    ).toBe('Last call: R2, C2, 9, called by John.');
  });
});
