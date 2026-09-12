/**
 * A whole bingo game, on the device.
 *
 * Ported verbatim from the React Native app:
 * `bingo-react-native/src/features/bot/engine/botGame.ts`.
 * Pure logic — no React Native, no DOM, no timers, no sockets. Keep the two
 * copies in sync; the mobile file is the original.
 *
 * ## Why it produces a `RoomSnapshot`
 *
 * `RoomSnapshot` is the contract the entire client is written against: the
 * board, the strike overlay, the cell labels, the progress rows, the spoken
 * commentary and every sound cue are pure projections of it, and none of them
 * knows or cares where it came from. Emitting one is what lets a single-player
 * mode reuse all of that rather than growing a second copy of the game.
 *
 * The snapshot is a faithful one, not a convenient one — the rules applied here
 * are ported from the server in `../../game/engine`, so a bot game scores,
 * breaks ties and ends exactly as a real one does.
 *
 * ## What is deliberately absent
 *
 * No room code that means anything, no lobby, no ready handshake, no
 * disconnection, no turn deadline. This is not a room; it only has to *look*
 * like one to the components downstream.
 */
import type {
  BoardSize,
  CallRecord,
  GameStatus,
  PlayerResult,
  PublicPlayer,
  RoomSnapshot,
} from '../../game/types';
import {
  findWinner,
  generateDistinctBoard,
  isCallable,
  lettersOf,
  nextSeat,
  wordForSize,
  type ScorablePlayer,
} from '../../game/engine';

export const HUMAN_SEAT = 0;
export const BOT_SEAT = 1;

/** The bot's player id. Never a real user id, so it can never collide. */
export const BOT_ID = 'bot';

/**
 * Named so the opponent is unmistakably a program.
 *
 * The label is the whole disclosure: nothing anywhere says what the bot is
 * thinking, how it chose, or what it can see — there is nothing to expose,
 * because it knows nothing a player would not.
 */
export const BOT_NAME = '🤖 Bot';

export interface BotGameState {
  size: BoardSize;
  status: GameStatus;
  /**
   * The player's real account id and name.
   *
   * Held in the state rather than applied when the snapshot is built, because
   * the *rules* need them: `findWinner` breaks a shared finish in favour of
   * whoever made the call, and the final standings are keyed by player id —
   * which the result screen compares against the signed-in user to know which
   * row is "You". A placeholder id here would quietly hand a tied game to the
   * wrong player and label the standings wrong.
   */
  human: HumanIdentity;
  /** Null until the player has laid theirs out and locked it in. */
  humanBoard: number[] | null;
  botBoard: number[];
  calledNumbers: number[];
  callHistory: CallRecord[];
  currentTurnSeat: number;
  winnerId?: string;
  /** Final standings, once there is a winner. */
  results?: PlayerResult[];
}

export interface HumanIdentity {
  id: string;
  name: string;
}

export interface StartOptions {
  size: BoardSize;
  human: HumanIdentity;
  /** Who takes the first turn. */
  firstTurn?: 'human' | 'bot';
}

/**
 * A fresh game, waiting for the player to lay out their board.
 *
 * The bot's board is dealt here, before the human has chosen anything, and is
 * never touched again — so it cannot have been arranged around the player's.
 */
export function startBotGame({
  size,
  human,
  firstTurn = 'human',
}: StartOptions): BotGameState {
  return {
    size,
    human,
    status: 'setup',
    humanBoard: null,
    botBoard: generateDistinctBoard(size, []),
    calledNumbers: [],
    callHistory: [],
    currentTurnSeat: firstTurn === 'bot' ? BOT_SEAT : HUMAN_SEAT,
  };
}

/**
 * Lock the player's board in and begin.
 *
 * The bot's board is re-dealt only if it happens to match the one the player
 * built, which would otherwise have both boards marking in lockstep.
 */
export function submitHumanBoard(
  state: BotGameState,
  board: number[],
): BotGameState {
  if (state.status !== 'setup') return state;
  return {
    ...state,
    humanBoard: board,
    botBoard: generateDistinctBoard(state.size, [board]),
    status: 'playing',
  };
}

/** Why a call was refused. Mirrors the server's error codes. */
export type CallRejection = 'bad_state' | 'not_your_turn' | 'already_called' | 'bad_number';

export interface CallOutcome {
  state: BotGameState;
  rejected?: CallRejection;
}

/**
 * Apply a called number.
 *
 * **Validation order is a rule, not a detail.** An already-called number is
 * rejected *without* passing the turn, so a misclick does not cost a player
 * their go — exactly as `game.manager.ts` does it server-side.
 */
export function callNumber(
  state: BotGameState,
  playerId: string,
  value: number,
): CallOutcome {
  if (state.status !== 'playing') return { state, rejected: 'bad_state' };

  const seat = playerId === BOT_ID ? BOT_SEAT : HUMAN_SEAT;
  if (seat !== state.currentTurnSeat) {
    return { state, rejected: 'not_your_turn' };
  }
  if (!isCallable(value, state.size)) return { state, rejected: 'bad_number' };
  if (state.calledNumbers.includes(value)) {
    return { state, rejected: 'already_called' };
  }

  const calledNumbers = [...state.calledNumbers, value];
  const callHistory = [...state.callHistory, { number: value, playerId }];

  // A call marks a cell on every board, so any player can complete a line —
  // including the one who did not make the call.
  const winner = findWinner(
    scorable(state),
    calledNumbers,
    state.size,
    playerId,
  );

  if (winner) {
    return {
      state: {
        ...state,
        calledNumbers,
        callHistory,
        status: 'finished',
        winnerId: winner.winnerId,
        results: winner.results,
      },
    };
  }

  return {
    state: {
      ...state,
      calledNumbers,
      callHistory,
      currentTurnSeat: nextSeat([HUMAN_SEAT, BOT_SEAT], state.currentTurnSeat),
    },
  };
}

/** Deal both boards again and go back to setup, keeping the settings. */
export function restartBotGame(state: BotGameState): BotGameState {
  return startBotGame({
    size: state.size,
    human: state.human,
    firstTurn: state.currentTurnSeat === BOT_SEAT ? 'bot' : 'human',
  });
}

function scorable(state: BotGameState): ScorablePlayer[] {
  return [
    {
      id: state.human.id,
      name: state.human.name,
      seat: HUMAN_SEAT,
      board: state.humanBoard ?? undefined,
    },
    { id: BOT_ID, name: BOT_NAME, seat: BOT_SEAT, board: state.botBoard },
  ];
}

/**
 * The state as the rest of the app expects to see it.
 *
 * Two things here are load-bearing:
 *
 * - **The human's id must be their real auth id.** `useGame` decides whether a
 *   call was yours by comparing against it, so a synthetic id would have the
 *   board announce "Someone called 7" for your own move.
 * - **`yourBoard` is the human's, and the bot's board is not in the snapshot at
 *   all.** Nothing downstream can render or read it, which is the fairness
 *   guarantee running in the other direction.
 */
export function toSnapshot(state: BotGameState): RoomSnapshot {
  const { human } = state;
  const players: PublicPlayer[] = [
    {
      id: human.id,
      name: human.name,
      seat: HUMAN_SEAT,
      // `ready` is what `useBoardSetup` reads to know the board is locked in.
      ready: state.humanBoard !== null,
      connected: true,
      letters: lettersOf(state.humanBoard ?? undefined, state.calledNumbers, state.size),
    },
    {
      id: BOT_ID,
      name: BOT_NAME,
      seat: BOT_SEAT,
      ready: true,
      connected: true,
      letters: lettersOf(state.botBoard, state.calledNumbers, state.size),
    },
  ];

  return {
    // Not a room code — nothing can be joined with it. It exists because the
    // feedback layer treats a change of `code` as "a different game", which is
    // exactly what a restart is.
    code: 'bot-game',
    size: state.size,
    maxPlayers: 2,
    status: state.status,
    hostId: human.id,
    word: wordForSize(state.size),
    players,
    currentTurnSeat: state.currentTurnSeat,
    calledNumbers: state.calledNumbers,
    callHistory: state.callHistory,
    winnerId: state.winnerId,
    // Untimed for now: no deadline is stamped, so the banner shows no countdown
    // and nothing has to be cancelled when the game ends.
    turnSeconds: 0,
    yourBoard: state.humanBoard ?? undefined,
  };
}

/** The winner payload the result screen reads its standings from. */
export function toWinnerPayload(
  state: BotGameState,
): { winnerId: string; results: PlayerResult[] } | null {
  if (!state.winnerId || !state.results) return null;
  return { winnerId: state.winnerId, results: state.results };
}
