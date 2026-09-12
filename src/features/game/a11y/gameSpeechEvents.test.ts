import { describe, expect, it } from 'vitest';
import { deriveAudioEvents } from '../audio/gameAudioEvents';
import { deriveSpeechEvents } from './gameSpeechEvents';
import type { PublicPlayer, RoomSnapshot } from '../types/events';

const ME = 'me';
const RIVAL = 'rival';

function player(
  id: string,
  seat: number,
  overrides: Partial<PublicPlayer> = {},
): PublicPlayer {
  return {
    id,
    name: id === RIVAL ? 'Ravi' : id,
    seat,
    ready: false,
    connected: true,
    letters: 0,
    ...overrides,
  };
}

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'brave-otter',
    size: 3,
    maxPlayers: 2,
    status: 'playing',
    hostId: RIVAL,
    word: 'BUS',
    players: [player(ME, 0), player(RIVAL, 1)],
    currentTurnSeat: 0,
    calledNumbers: [],
    callHistory: [],
    turnSeconds: 60,
    yourBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    ...overrides,
  };
}

/** Drive speech through the real audio diff, as the bridge does. */
function speak(prev: RoomSnapshot | null, next: RoomSnapshot | null) {
  const audioEvents = deriveAudioEvents(prev, next, ME);
  return deriveSpeechEvents(prev, next, ME, { audioEvents }).map(e => e.text);
}

describe('deriveSpeechEvents', () => {
  it('names the caller and says whether it landed on your board', () => {
    const before = room({ currentTurnSeat: 1 });
    const after = room({
      currentTurnSeat: 1,
      calledNumbers: [4],
      callHistory: [{ number: 4, playerId: RIVAL }],
    });

    expect(speak(before, after)).toEqual([
      'Ravi called 4. Marked on your board',
    ]);
  });

  it('says when a call missed your board', () => {
    const before = room({ currentTurnSeat: 1 });
    const after = room({
      currentTurnSeat: 1,
      yourBoard: [11, 12, 13, 14, 15, 16, 17, 18, 19],
      calledNumbers: [4],
      callHistory: [{ number: 4, playerId: RIVAL }],
    });

    expect(speak(before, after)).toEqual([
      'Ravi called 4. Not on your board',
    ]);
  });

  it('calls you "You" rather than your name', () => {
    const before = room({ currentTurnSeat: 0 });
    const after = room({
      currentTurnSeat: 1,
      calledNumbers: [4],
      callHistory: [{ number: 4, playerId: ME }],
    });
    expect(speak(before, after)[0]).toBe('You called 4. Marked on your board');
  });

  it('reports line progress with a running count', () => {
    const before = room({
      currentTurnSeat: 1,
      players: [player(ME, 0), player(RIVAL, 1)],
      calledNumbers: [1, 2],
      callHistory: [
        { number: 1, playerId: ME },
        { number: 2, playerId: RIVAL },
      ],
    });
    const after = room({
      currentTurnSeat: 1,
      // size 3, so 1 line is not yet the one-away milestone (that is 2).
      players: [player(ME, 0, { letters: 1 }), player(RIVAL, 1)],
      calledNumbers: [1, 2, 3],
      callHistory: [
        { number: 1, playerId: ME },
        { number: 2, playerId: RIVAL },
        { number: 3, playerId: ME },
      ],
    });

    // Which line, and which letter it earned — both readable off the screen,
    // neither previously spoken.
    expect(speak(before, after)).toContain(
      'Row 1 complete. Letter B earned. 1 line of 3',
    );
  });

  it('replaces the line count with the near-win warning at one away', () => {
    const before = room({
      currentTurnSeat: 1,
      players: [player(ME, 0, { letters: 1 }), player(RIVAL, 1)],
    });
    const after = room({
      currentTurnSeat: 1,
      players: [player(ME, 0, { letters: 2 }), player(RIVAL, 1)],
    });

    const spoken = speak(before, after);
    expect(spoken).toContain('One line from winning');
    expect(spoken.some(t => t.startsWith('Line complete'))).toBe(false);
  });

  it('warns when an opponent is one away', () => {
    const before = room({
      players: [player(ME, 0), player(RIVAL, 1, { letters: 1 })],
    });
    const after = room({
      players: [player(ME, 0), player(RIVAL, 1, { letters: 2 })],
    });
    expect(speak(before, after)).toContain(
      'An opponent is one line from winning',
    );
  });

  it('announces a timeout and the turn that follows it', () => {
    const before = room({ currentTurnSeat: 1 });
    const after = room({ currentTurnSeat: 0 });
    expect(speak(before, after)).toEqual(['Time up', 'Your turn']);
  });

  it('names the opponent whose turn it is', () => {
    const before = room({ currentTurnSeat: 0 });
    const after = room({
      currentTurnSeat: 1,
      calledNumbers: [4],
      callHistory: [{ number: 4, playerId: ME }],
    });
    expect(speak(before, after)).toContain("Ravi's turn");
  });

  it('says only the result when the game ends', () => {
    const before = room({ currentTurnSeat: 0 });
    const after = room({
      status: 'finished',
      winnerId: ME,
      players: [player(ME, 0, { letters: 3 }), player(RIVAL, 1)],
      calledNumbers: [1, 2, 3],
      callHistory: [
        { number: 1, playerId: ME },
        { number: 2, playerId: ME },
        { number: 3, playerId: ME },
      ],
    });

    // The most important moment must not be buried under call commentary.
    expect(speak(before, after)).toEqual(['You win. Ravi second']);
  });

  it('names the winner and where you came, when you lose', () => {
    // "Better luck next time" told a player nothing about the game they had
    // just played. Their placing does, and is what the results screen shows
    // them a moment later anyway.
    const before = room();
    const after = room({ status: 'finished', winnerId: RIVAL });
    expect(speak(before, after)).toEqual(['Ravi wins. You second']);
  });

  it('reports the room collapsing back to the lobby', () => {
    const before = room({ status: 'setup' });
    const after = room({ status: 'lobby', players: [player(ME, 0)] });
    const spoken = speak(before, after);
    expect(spoken).toContain('Ravi left. 1 player remaining');
    expect(spoken).toContain('Not enough players. Back to the lobby');
  });

  it('stays silent with no previous snapshot', () => {
    expect(speak(null, room())).toEqual([]);
  });
});

describe('room state awareness', () => {
  it('names who joined and how full the room now is', () => {
    // A join used to be a chime and nothing else, so a blind host had to guess
    // whether the room was ready to start.
    const before = room({ status: 'lobby', players: [player(ME, 0)] });
    const after = room({ status: 'lobby' });
    expect(speak(before, after)).toContain('Ravi joined. 2 players in the room');
  });

  it('says who is in and what you are spelling when the game starts', () => {
    const before = room({ status: 'setup' });
    const after = room({ status: 'playing' });
    expect(speak(before, after)).toContain(
      'Game started. 2 players: You and Ravi. Target word BUS',
    );
  });

  it('counts the room down as well as naming who went', () => {
    const before = room({ players: [player(ME, 0), player(RIVAL, 1)] });
    const after = room({ players: [player(ME, 0)] });
    expect(speak(before, after)).toContain('Ravi left. 1 player remaining');
  });
});

describe('near-strike warning', () => {
  /** The board is 1..9 in order, so row 1 is 1, 2, 3. */
  const called = (numbers: number[]) =>
    room({
      currentTurnSeat: 1,
      calledNumbers: numbers,
      callHistory: numbers.map(number => ({ number, playerId: RIVAL })),
    });

  it('says which line is one cell away, and which cell', () => {
    // Only 1 and 2 called: row 1 needs 3, at C1, and nothing else is close.
    const spoken = speak(called([1]), called([1, 2]));
    expect(spoken).toContain('1 strike away: Row 1 at C1.');
  });

  it('stays quiet while nothing is close', () => {
    const spoken = speak(called([]), called([1]));
    expect(spoken.some(text => text.includes('strike away'))).toBe(false);
  });

  it('names every line that is one away, not just the first', () => {
    // 1, 2 and 4 called: row 1 needs 3 (C1) *and* column A needs 7 (A3). Both
    // are worth hearing — a player told only about the row would miss the
    // column that is equally close.
    const spoken = speak(called([1, 2]), called([1, 2, 4]));
    expect(spoken).toContain('2 strikes away: Row 1 at C1 and Column A at A3.');
  });

  it('follows the player’s chosen notation', () => {
    const before = called([1, 2]);
    const after = called([1, 2, 4]);
    const events = deriveSpeechEvents(before, after, ME, {
      audioEvents: deriveAudioEvents(before, after, ME),
      notation: 'rowcol',
    });
    expect(events.map(e => e.text)).toContain(
      '2 strikes away: Row 1 at R1, C3 and Column 1 at R3, C1.',
    );
  });
});

