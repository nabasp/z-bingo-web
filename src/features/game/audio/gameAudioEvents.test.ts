/**
 * Ported verbatim from the React Native app:
 * `bingo-react-native/src/features/game/audio/gameAudioEvents.test.ts`.
 * Pure logic, so the suite carries over unchanged apart from the test-runner
 * import. Keep the two copies in sync; the mobile file is the original.
 */
import { describe, expect, it } from 'vitest';
import { deriveAudioEvents } from './gameAudioEvents';
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
    name: id,
    seat,
    ready: false,
    connected: true,
    letters: 0,
    ...overrides,
  };
}

/**
 * A 3×3 room. `yourBoard` is 1..9 in order, so cells 0-2 (the top row) hold the
 * numbers 1, 2 and 3 — calling all three completes exactly one line.
 */
function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'brave-otter',
    size: 3,
    maxPlayers: 2,
    status: 'lobby',
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

/** Just the keys, for terser assertions. */
const keys = (prev: RoomSnapshot | null, next: RoomSnapshot | null) =>
  deriveAudioEvents(prev, next, ME).map(e => e.key);

describe('deriveAudioEvents', () => {
  describe('entering a room', () => {
    it('plays lobby_joined when landing in someone else’s lobby', () => {
      expect(keys(null, room())).toEqual(['lobby_joined']);
    });

    it('stays silent for the host, who already heard room_created', () => {
      expect(keys(null, room({ hostId: ME }))).toEqual([]);
    });

    it('stays silent when reconnecting mid-game', () => {
      // A reconnect also arrives as null → snapshot; without the status guard
      // this would fire lobby_joined and game_start on every dropped socket.
      expect(keys(null, room({ status: 'playing' }))).toEqual([]);
    });

    it('plays lobby_joined when another player arrives', () => {
      const before = room({ players: [player(ME, 0)] });
      const after = room({ players: [player(ME, 0), player(RIVAL, 1)] });
      expect(keys(before, after)).toEqual(['lobby_joined']);
    });

    it('ignores an unrelated room code', () => {
      expect(keys(room(), room({ code: 'other-code', status: 'playing' }))).toEqual(
        [],
      );
    });
  });

  describe('lobby readiness', () => {
    it('plays ready_confirmed when you ready up', () => {
      const before = room();
      const after = room({
        players: [player(ME, 0, { ready: true }), player(RIVAL, 1)],
      });
      expect(keys(before, after)).toEqual(['ready_confirmed']);
    });

    it('plays everyone_ready once the last player is in', () => {
      const before = room({
        players: [player(ME, 0, { ready: true }), player(RIVAL, 1)],
      });
      const after = room({
        players: [
          player(ME, 0, { ready: true }),
          player(RIVAL, 1, { ready: true }),
        ],
      });
      expect(keys(before, after)).toEqual(['everyone_ready']);
    });

    it('does not repeat everyone_ready on later snapshots', () => {
      const ready = room({
        players: [
          player(ME, 0, { ready: true }),
          player(RIVAL, 1, { ready: true }),
        ],
      });
      expect(keys(ready, ready)).toEqual([]);
    });
  });

  describe('start of play', () => {
    it('plays game_start, and delays your_turn behind it', () => {
      const before = room({ status: 'setup' });
      const after = room({ status: 'playing', currentTurnSeat: 0 });

      expect(keys(before, after)).toEqual(['game_start', 'your_turn']);

      const turn = deriveAudioEvents(before, after, ME).find(
        e => e.key === 'your_turn',
      );
      expect(turn?.delayMs).toBe(1000);
    });

    it('plays only game_start when the opponent goes first', () => {
      const before = room({ status: 'setup' });
      const after = room({ status: 'playing', currentTurnSeat: 1 });
      expect(keys(before, after)).toEqual(['game_start']);
    });
  });

  describe('calls', () => {
    const playing = room({ status: 'playing', currentTurnSeat: 1 });

    it('plays number_marked when the call hits your board', () => {
      const after = room({
        status: 'playing',
        currentTurnSeat: 1,
        calledNumbers: [4],
        callHistory: [{ number: 4, playerId: RIVAL }],
      });
      expect(keys(playing, after)).toEqual(['number_marked']);
    });

    it('plays number_called when it misses your board', () => {
      const after = room({
        status: 'playing',
        currentTurnSeat: 1,
        yourBoard: [11, 12, 13, 14, 15, 16, 17, 18, 19],
        calledNumbers: [4],
        callHistory: [{ number: 4, playerId: RIVAL }],
      });
      expect(keys(playing, after)).toEqual(['number_called']);
    });

    it('never plays both for one call', () => {
      const after = room({
        status: 'playing',
        currentTurnSeat: 1,
        calledNumbers: [4],
        callHistory: [{ number: 4, playerId: RIVAL }],
      });
      const played = keys(playing, after);
      expect(played).not.toContain('number_called');
      expect(played).toHaveLength(1);
    });

    it('plays your_turn when the turn comes back to you', () => {
      const after = room({
        status: 'playing',
        currentTurnSeat: 0,
        calledNumbers: [4],
        callHistory: [{ number: 4, playerId: RIVAL }],
      });
      expect(keys(playing, after)).toEqual(['number_marked', 'your_turn']);
    });

    it('plays opponent_turn when the turn leaves you', () => {
      const mine = room({ status: 'playing', currentTurnSeat: 0 });
      const theirs = room({
        status: 'playing',
        currentTurnSeat: 1,
        calledNumbers: [4],
        callHistory: [{ number: 4, playerId: ME }],
      });
      expect(keys(mine, theirs)).toEqual(['number_marked', 'opponent_turn']);
    });
  });

  describe('turn timeout', () => {
    it('infers a timeout from a turn that moved with no call behind it', () => {
      const before = room({ status: 'playing', currentTurnSeat: 1 });
      const after = room({ status: 'playing', currentTurnSeat: 0 });

      const events = deriveAudioEvents(before, after, ME);
      expect(events.map(e => e.key)).toEqual(['turn_timeout', 'your_turn']);
      // The turn cue trails the buzz rather than landing on top of it.
      expect(events.find(e => e.key === 'your_turn')?.delayMs).toBe(650);
    });

    it('does not fire when a call moved the turn', () => {
      const before = room({ status: 'playing', currentTurnSeat: 1 });
      const after = room({
        status: 'playing',
        currentTurnSeat: 0,
        calledNumbers: [4],
        callHistory: [{ number: 4, playerId: RIVAL }],
      });
      expect(keys(before, after)).not.toContain('turn_timeout');
    });

    it('does not fire when a player leaving moved the turn', () => {
      const before = room({
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0), player(RIVAL, 1), player('third', 2)],
      });
      const after = room({
        status: 'playing',
        currentTurnSeat: 0,
        players: [player(ME, 0), player('third', 2)],
      });
      const played = keys(before, after);
      expect(played).toContain('player_left');
      expect(played).not.toContain('turn_timeout');
    });
  });

  describe('roster changes', () => {
    it('plays player_left when someone drops out', () => {
      const before = room();
      const after = room({ players: [player(ME, 0)] });
      expect(keys(before, after)).toEqual(['player_left']);
    });

    it('plays player_reconnected when a dropped player returns', () => {
      const before = room({
        players: [player(ME, 0), player(RIVAL, 1, { connected: false })],
      });
      const after = room({
        players: [player(ME, 0), player(RIVAL, 1, { connected: true })],
      });
      expect(keys(before, after)).toEqual(['player_reconnected']);
    });

    it('plays room_closed when setup collapses back to the lobby', () => {
      const before = room({ status: 'setup' });
      const after = room({ status: 'lobby', players: [player(ME, 0)] });
      expect(keys(before, after)).toEqual(['player_left', 'room_closed']);
    });
  });

  describe('progress', () => {
    it('plays line_complete, then letter_earned as a delayed fanfare', () => {
      const before = room({
        status: 'playing',
        currentTurnSeat: 1,
        calledNumbers: [1, 2],
        callHistory: [
          { number: 1, playerId: ME },
          { number: 2, playerId: RIVAL },
        ],
      });
      // Calling 3 completes the top row (numbers 1, 2, 3).
      const after = room({
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0, { letters: 1 }), player(RIVAL, 1)],
        calledNumbers: [1, 2, 3],
        callHistory: [
          { number: 1, playerId: ME },
          { number: 2, playerId: RIVAL },
          { number: 3, playerId: ME },
        ],
      });

      const events = deriveAudioEvents(before, after, ME);
      expect(events.map(e => e.key)).toEqual([
        'number_marked',
        'line_complete',
        'letter_earned',
      ]);
      // The two share a trigger instant, so the offset is what keeps them apart.
      expect(events.find(e => e.key === 'letter_earned')?.delayMs).toBe(350);
      expect(events.find(e => e.key === 'line_complete')?.delayMs).toBeUndefined();
    });

    it('does not scan for lines when no number was called', () => {
      // The board scan is guarded on a call having happened — a roster-only
      // snapshot must not produce a line cue.
      const before = room({
        status: 'playing',
        currentTurnSeat: 1,
        calledNumbers: [1, 2, 3],
        callHistory: [
          { number: 1, playerId: ME },
          { number: 2, playerId: ME },
          { number: 3, playerId: ME },
        ],
      });
      const after = {
        ...before,
        players: [player(ME, 0), player(RIVAL, 1, { connected: false })],
      };
      expect(keys(before, after)).not.toContain('line_complete');
    });

    it('plays opponent_line when a rival gains a line', () => {
      const before = room({ status: 'playing', currentTurnSeat: 1 });
      const after = room({
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0), player(RIVAL, 1, { letters: 1 })],
      });
      expect(keys(before, after)).toEqual(['opponent_line']);
    });

    it('substitutes near_win for letter_earned at one-away', () => {
      // size 3 → one away is 2 letters.
      const before = room({
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0, { letters: 1 }), player(RIVAL, 1)],
      });
      const after = room({
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0, { letters: 2 }), player(RIVAL, 1)],
      });

      const played = keys(before, after);
      expect(played).toEqual(['near_win']);
      // Three cues on one instant would be noise, so the generic one drops out.
      expect(played).not.toContain('letter_earned');
    });

    it('substitutes opponent_near_win for opponent_line at one-away', () => {
      const before = room({
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0), player(RIVAL, 1, { letters: 1 })],
      });
      const after = room({
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0), player(RIVAL, 1, { letters: 2 })],
      });

      const played = keys(before, after);
      expect(played).toEqual(['opponent_near_win']);
      expect(played).not.toContain('opponent_line');
    });

    it('still plays letter_earned when not yet one away', () => {
      // On a 5×5, reaching 2 letters is not the one-away milestone.
      const before = room({
        size: 5,
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0, { letters: 1 }), player(RIVAL, 1)],
        yourBoard: undefined,
      });
      const after = room({
        size: 5,
        status: 'playing',
        currentTurnSeat: 1,
        players: [player(ME, 0, { letters: 2 }), player(RIVAL, 1)],
        yourBoard: undefined,
      });
      expect(keys(before, after)).toEqual(['letter_earned']);
    });
  });

  describe('game over', () => {
    it('plays you_win alone, suppressing everything else in the diff', () => {
      const before = room({ status: 'playing', currentTurnSeat: 0 });
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
      expect(keys(before, after)).toEqual(['you_win']);
    });

    it('plays you_lose when someone else wins', () => {
      const before = room({ status: 'playing' });
      const after = room({ status: 'finished', winnerId: RIVAL });
      expect(keys(before, after)).toEqual(['you_lose']);
    });

    it('does not replay the stinger on later finished snapshots', () => {
      const finished = room({ status: 'finished', winnerId: ME });
      expect(keys(finished, finished)).toEqual([]);
    });
  });

  it('is silent when the room goes away', () => {
    expect(keys(room(), null)).toEqual([]);
  });
});

describe('why the turn moved', () => {
  const before = room({ status: 'playing', currentTurnSeat: 0 });
  /** A turn that advanced with nothing else changing — the ambiguous case. */
  const after = room({ status: 'playing', currentTurnSeat: 1 });

  const firedWith = (reason?: 'timeout' | 'player_left') =>
    deriveAudioEvents(before, after, ME, {
      turnChangeReason: reason,
    }).map(e => e.key);

  it('guesses a timeout when the server said nothing, as it always did', () => {
    expect(firedWith()).toContain('turn_timeout');
  });

  it('believes the server over the guess', () => {
    // A grace period expiring moves the turn with no call behind it, which the
    // old inference read as the clock running out. The server has been sending
    // the real reason all along.
    expect(firedWith('player_left')).not.toContain('turn_timeout');
  });

  it('still reports a genuine timeout when the server says so', () => {
    expect(firedWith('timeout')).toContain('turn_timeout');
  });
});

