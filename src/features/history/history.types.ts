/**
 * Wire shapes for game history and rankings.
 *
 * MIRROR of the server's `modules/results/results.routes.ts`.
 *
 * Ported verbatim from the React Native app:
 * `bingo-react-native/src/features/history/history.types.ts`. Keep the copies
 * in sync; the mobile file is the original. Change all three together.
 */

/** How one player's game turned out. */
export type PlayerResult = 'won' | 'lost' | 'left' | 'cancelled';

export type GameStatus = 'completed' | 'cancelled';

export type GameEndReason =
  | 'bingo'
  | 'walkover'
  | 'idle_timeout'
  | 'server_shutdown'
  | 'everyone_left';

export type HistoryFilter = 'all' | 'wins' | 'losses';

/** One row of a player's history. */
export interface HistoryItem {
  id: string;
  /** Four characters, for display. The full `id` is what links to the game. */
  shortId: string;
  size: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  status: GameStatus;
  result: PlayerResult;
  /** 1 is the winner. Null for a cancelled game, where nobody finished. */
  rank: number | null;
  playerCount: number;
  winnerName: string | null;
  isWinner: boolean;
}

export interface GameDetailsPlayer {
  name: string;
  seat: number;
  letters: number;
  rank: number | null;
  result: PlayerResult;
  isYou: boolean;
  isWinner: boolean;
}

export interface GameDetails {
  id: string;
  shortId: string;
  size: number;
  word: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  status: GameStatus;
  endReason: GameEndReason;
  winnerName: string | null;
  /** Finishing order: winner first, anyone who left last. */
  players: GameDetailsPlayer[];
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  gamesPlayed: number;
  wins: number;
  /** 0–1. */
  winRate: number;
  points: number;
  isYou: boolean;
}

export interface HistoryResponse {
  success: true;
  games: HistoryItem[];
  nextCursor?: string;
}

export interface GameDetailsResponse {
  success: true;
  game: GameDetails;
}

export interface LeaderboardResponse {
  success: true;
  period: 'all';
  players: LeaderboardEntry[];
  nextCursor?: string;
}

export interface MyRankingResponse {
  success: true;
  period: 'all';
  /** Null until the player has finished a game. */
  me: LeaderboardEntry | null;
}
