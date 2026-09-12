import { describe, expect, it } from 'vitest';
import type { BoardSize } from '../../game/types';
import {
  BOT_ID,
  BOT_SEAT,
  HUMAN_SEAT,
  callNumber,
  restartBotGame,
  startBotGame,
  submitHumanBoard,
  toSnapshot,
  toWinnerPayload,
  type BotGameState,
} from './botGame';

const SIZE: BoardSize = 3;
const ME = 'user-1';
const HUMAN = { id: ME, name: 'Siv' };
/** 1..9 in reading order, so row 1 is 1, 2, 3. */
const BOARD = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function playing(overrides: Partial<BotGameState> = {}): BotGameState {
  const started = submitHumanBoard(
    startBotGame({ size: SIZE, human: HUMAN }),
    BOARD,
  );
  return { ...started, ...overrides };
}

describe('starting a game', () => {
  it('waits for the player to lay their board out', () => {
    const state = startBotGame({ size: SIZE, human: HUMAN });
    expect(state.status).toBe('setup');
    expect(state.humanBoard).toBeNull();
  });

  it('deals the bot a full board before the player has chosen anything', () => {
    // Dealt up front, so it cannot have been arranged around the human's.
    const state = startBotGame({ size: SIZE, human: HUMAN });
    expect([...state.botBoard].sort((a, b) => a - b)).toEqual(BOARD);
  });

  it('lets the bot take the first turn when asked', () => {
    expect(startBotGame({ size: SIZE, human: HUMAN }).currentTurnSeat).toBe(HUMAN_SEAT);
    expect(
      startBotGame({ size: SIZE, human: HUMAN, firstTurn: 'bot' }).currentTurnSeat,
    ).toBe(BOT_SEAT);
  });
});

describe('submitting the board', () => {
  it('starts play', () => {
    const state = submitHumanBoard(startBotGame({ size: SIZE, human: HUMAN }), BOARD);
    expect(state.status).toBe('playing');
    expect(state.humanBoard).toEqual(BOARD);
  });

  it('gives the two players different boards', () => {
    // Identical boards would mark in lockstep and complete every line on the
    // same turn, making the game a coin flip on who calls first.
    const state = submitHumanBoard(startBotGame({ size: SIZE, human: HUMAN }), BOARD);
    expect(state.botBoard.join(',')).not.toBe(BOARD.join(','));
    expect([...state.botBoard].sort((a, b) => a - b)).toEqual(BOARD);
  });

  it('is ignored once the game is under way', () => {
    const state = playing();
    expect(submitHumanBoard(state, BOARD)).toBe(state);
  });
});

describe('calling a number', () => {
  it('records the call and passes the turn', () => {
    const { state } = callNumber(playing(), ME, 5);
    expect(state.calledNumbers).toEqual([5]);
    expect(state.callHistory).toEqual([{ number: 5, playerId: ME }]);
    expect(state.currentTurnSeat).toBe(BOT_SEAT);
  });

  it('refuses a call out of turn', () => {
    const { state, rejected } = callNumber(playing(), BOT_ID, 5);
    expect(rejected).toBe('not_your_turn');
    expect(state.calledNumbers).toEqual([]);
  });

  /**
   * Validation order is a rule, not a detail — the same one the server keeps.
   */
  it('rejects an already-called number without costing the turn', () => {
    const first = callNumber(playing(), ME, 5).state;
    const backToMe = { ...first, currentTurnSeat: HUMAN_SEAT };
    const { state, rejected } = callNumber(backToMe, ME, 5);

    expect(rejected).toBe('already_called');
    expect(state.currentTurnSeat).toBe(HUMAN_SEAT);
    expect(state.calledNumbers).toEqual([5]);
  });

  it('rejects a number that is not on any board', () => {
    expect(callNumber(playing(), ME, 99).rejected).toBe('bad_number');
    expect(callNumber(playing(), ME, 0).rejected).toBe('bad_number');
  });

  it('refuses to play on after the game is over', () => {
    const finished = playing({ status: 'finished' });
    expect(callNumber(finished, ME, 5).rejected).toBe('bad_state');
  });
});

describe('winning', () => {
  /** Everything but the final number of three of the human's lines. */
  const nearlyWon = () =>
    playing({ calledNumbers: [1, 2, 3, 4, 5, 6, 7, 8], currentTurnSeat: HUMAN_SEAT });

  it('ends the game on the winning call', () => {
    const { state } = callNumber(nearlyWon(), ME, 9);
    expect(state.status).toBe('finished');
    expect(state.winnerId).toBe(ME);
  });

  it('carries standings the result screen can read', () => {
    const { state } = callNumber(nearlyWon(), ME, 9);
    const payload = toWinnerPayload(state)!;
    expect(payload.results).toHaveLength(2);
    // Keyed by the real account id, or the result screen cannot tell which row
    // is the player's own.
    expect(payload.results.map(r => r.playerId)).toContain(ME);
    expect(payload.results.find(r => r.playerId === ME)!.lines.length).toBeGreaterThan(0);
  });

  it('lets the bot win on its own turn', () => {
    // Both boards hold all of 1..9, so once eight are called the ninth ends it
    // for whoever calls — here, the bot.
    const state = playing({
      calledNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
      currentTurnSeat: BOT_SEAT,
    });
    const after = callNumber(state, BOT_ID, 9).state;
    expect(after.status).toBe('finished');
    expect(after.winnerId).toBe(BOT_ID);
  });

  it('is nobody yet while the boards are unfinished', () => {
    expect(toWinnerPayload(playing())).toBeNull();
  });
});

describe('restarting', () => {
  it('deals fresh boards and forgets the old game', () => {
    const played = callNumber(playing(), ME, 5).state;
    const again = restartBotGame(played);

    expect(again.status).toBe('setup');
    expect(again.humanBoard).toBeNull();
    expect(again.calledNumbers).toEqual([]);
    expect(again.callHistory).toEqual([]);
    expect(again.winnerId).toBeUndefined();
  });

  it('keeps the settings the player chose', () => {
    const played = playing({ currentTurnSeat: BOT_SEAT });
    expect(restartBotGame(played).size).toBe(SIZE);
  });
});

describe('the snapshot', () => {
  it('names the player by their real account id', () => {
    // `useGame` decides whether a call was yours by comparing against this.
    const snapshot = toSnapshot(playing());
    expect(snapshot.players[HUMAN_SEAT].id).toBe(ME);
  });

  it('never carries the bot’s board', () => {
    // Nothing downstream can render or read it — the fairness guarantee in the
    // other direction.
    const snapshot = toSnapshot(playing());
    expect(snapshot.yourBoard).toEqual(BOARD);
    expect(JSON.stringify(snapshot)).not.toContain(
      JSON.stringify(playing().botBoard),
    );
  });

  it('gives the board its own word, not always BINGO', () => {
    expect(toSnapshot(playing()).word).toBe('BUS');
  });

  it('scores both players from the called numbers', () => {
    const state = playing({ calledNumbers: [1, 2, 3] });
    const snapshot = toSnapshot(state);
    expect(snapshot.players[HUMAN_SEAT].letters).toBe(1);
  });

  it('marks the player ready only once their board is in', () => {
    const fresh = startBotGame({ size: SIZE, human: HUMAN });
    expect(toSnapshot(fresh).players[HUMAN_SEAT].ready).toBe(false);
    expect(toSnapshot(playing()).players[HUMAN_SEAT].ready).toBe(true);
  });

  it('stamps no turn deadline, this mode being untimed', () => {
    expect(toSnapshot(playing()).turnEndsAt).toBeUndefined();
  });
});
