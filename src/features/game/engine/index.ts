/**
 * The bingo rules, client-side.
 *
 * Ported verbatim from the React Native app:
 * `bingo-react-native/src/features/game/engine/index.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * **Why this exists.** In a multiplayer room the server owns all of this and
 * the client only renders what it is told — that is deliberate and unchanged.
 * But Play With Bot has no server, so the rules it plays by have to exist here
 * too. Everything below is a faithful port of
 * `bingo-server/src/modules/game/{game.engine,winner.service,turn.manager}.ts`,
 * built on the line geometry the client already had.
 *
 * Faithful is the operative word: a bot game that scored differently, or broke
 * a tie differently, would not be the same game. Where the server makes a
 * decision, the reason is repeated here so the two cannot drift apart quietly.
 */
import type { BoardSize, Cell, LineDescriptor, PlayerResult } from '../types';
import { completedLines, generatePermutation, toCells } from '../utils';

/**
 * The word a player spells by completing lines. Its length always equals the
 * board size, which is also the number of lines needed to win.
 *
 * Ported from the server, which sends it as `RoomSnapshot.word`. The client had
 * no copy, so every local fallback said "BINGO" whatever the board size — which
 * is wrong for five of the six sizes.
 */
export const WORD_BY_SIZE: Record<number, string> = {
  3: 'BUS',
  4: 'GAME',
  5: 'BINGO',
  6: 'WINNER',
  7: 'JACKPOT',
  8: 'CHAMPION',
};

export function wordForSize(size: number): string {
  return WORD_BY_SIZE[size] ?? 'BINGO';
}

export interface Evaluation {
  completedLines: LineDescriptor[];
  /** Letters earned — completed lines, capped at the board size. */
  letters: number;
  won: boolean;
}

/**
 * Score one board against the numbers called so far.
 *
 * Marks are always *derived* from `called`, never stored — the same rule the
 * server enforces, and the reason a board cannot be made to look further along
 * than it is.
 */
export function evaluate(
  board: readonly number[],
  called: ReadonlySet<number>,
  size: number,
): Evaluation {
  const cells: Cell[] = board.map((value, index) => ({
    index,
    value,
    marked: called.has(value),
  }));
  const lines = completedLines(cells, size);
  return {
    completedLines: lines,
    letters: Math.min(lines.length, size),
    won: lines.length >= size,
  };
}

/** Letters earned on a board, for `PublicPlayer.letters`. */
export function lettersOf(
  board: readonly number[] | undefined,
  called: readonly number[],
  size: number,
): number {
  if (!board) return 0;
  return evaluate(board, new Set(called), size).letters;
}

/** A player seat as the winner logic needs to see it. */
export interface ScorablePlayer {
  id: string;
  name: string;
  seat: number;
  board: readonly number[] | undefined;
}

/** Final standings, ordered by seat. */
export function buildResults(
  players: readonly ScorablePlayer[],
  called: readonly number[],
  size: number,
): PlayerResult[] {
  const numbers = new Set(called);
  return players
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map(player => {
      const scored = player.board
        ? evaluate(player.board, numbers, size)
        : null;
      return {
        playerId: player.id,
        name: player.name,
        seat: player.seat,
        letters: scored?.letters ?? 0,
        lines: scored?.completedLines ?? [],
      };
    });
}

export interface WinnerOutcome {
  winnerId: string;
  results: PlayerResult[];
}

/**
 * Decide the winner after a call, or null if nobody has finished.
 *
 * Every board holds all of 1..n², so one call can complete the final line for
 * more than one player at once. Ties resolve deterministically — there are no
 * draws: **the caller wins their own call, otherwise the lowest seat takes it.**
 * Ported exactly from `winner.service.ts`; changing it here would make a bot
 * game end differently from a real one.
 */
export function findWinner(
  players: readonly ScorablePlayer[],
  called: readonly number[],
  size: number,
  callerId: string,
): WinnerOutcome | null {
  const numbers = new Set(called);
  const finished = players.filter(
    player => player.board && evaluate(player.board, numbers, size).won,
  );
  if (finished.length === 0) return null;

  const winner =
    finished.find(player => player.id === callerId) ??
    finished.reduce((best, player) => (player.seat < best.seat ? player : best));

  return {
    winnerId: winner.id,
    results: buildResults(players, called, size),
  };
}

/**
 * Next seat clockwise, wrapping inclusively.
 *
 * The wrap includes `fromSeat` so that with a single seat the turn simply stays
 * put rather than becoming undefined. The server additionally prefers connected
 * players; locally nobody can disconnect, so that branch has no meaning here.
 */
export function nextSeat(seats: readonly number[], fromSeat: number): number {
  const ordered = seats.slice().sort((a, b) => a - b);
  if (ordered.length === 0) return 0;
  return ordered.find(seat => seat > fromSeat) ?? ordered[0];
}

/**
 * A board nobody else in the game already holds.
 *
 * Two identical boards would mark in lockstep and complete every line on the
 * same turn, which reduces the game to whoever calls first. Re-rolling is
 * enough in practice — the smallest board has 9! arrangements and there are two
 * players — and the loop is bounded so a degenerate RNG cannot spin forever.
 */
const DISTINCT_BOARD_ATTEMPTS = 20;

export function generateDistinctBoard(
  size: BoardSize,
  existing: readonly (readonly number[])[],
): number[] {
  const taken = new Set(existing.map(board => board.join(',')));
  let board = generatePermutation(size);
  for (
    let attempt = 0;
    attempt < DISTINCT_BOARD_ATTEMPTS && taken.has(board.join(','));
    attempt++
  ) {
    board = generatePermutation(size);
  }
  return board;
}

/** True when `value` is a number this board could legally have called. */
export function isCallable(value: number, size: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= size * size;
}

/** Re-exported so callers need only one import for the local rules. */
export { completedLines, toCells };
