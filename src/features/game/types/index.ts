/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/types/index.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

/**
 * Multiplayer game domain types.
 *
 * The live wire contract lives in `./events` (mirrored from the server) and is
 * re-exported here. The types below are local UI/presentation shapes.
 */

export * from './events';

export type BoardSize = 3 | 4 | 5 | 6 | 7 | 8;

export type ReadyStatus = 'ready' | 'not-ready';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type VoiceStatus = 'mic-on' | 'mic-off';

export interface Player {
  id: string;
  name: string;
  /** True for the current device's user ("You"). */
  isYou: boolean;
  isHost: boolean;
  ready: ReadyStatus;
  connection: ConnectionStatus;
  voice: VoiceStatus;
}

export interface Room {
  code: string;
  name?: string;
  boardSize: BoardSize;
  maxPlayers: number;
}

/** A board cell. `value` is null when empty. `marked` = called during the game. */
export interface Cell {
  index: number;
  value: number | null;
  marked: boolean;
}

export interface Announcement {
  id: string;
  number: number;
  byName: string;
  message: string;
}

export interface PlayerProgress {
  playerId: string;
  name: string;
  matched: number;
  target: number;
}

export interface RankingEntry {
  playerId: string;
  name: string;
  place: number;
  detail: string;
}

export interface GameResult {
  winnerName: string;
  reason: string;
  turns: number;
  rankings: RankingEntry[];
}
