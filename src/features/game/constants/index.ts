/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/constants/index.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import type { BoardSize } from '../types';

/** Selectable board sizes (per the design: 3×3 … 8×8). */
export const BOARD_SIZES: BoardSize[] = [3, 4, 5, 6, 7, 8];

/** Selectable max players. */
export const MAX_PLAYERS_OPTIONS = [2, 3] as const;

/**
 * Selectable turn durations, in seconds. Mirrors `TURN_SECONDS_OPTIONS` on the
 * server, which is the one that actually enforces the deadline.
 */
export const TURN_TIMER_OPTIONS = [60, 120, 180, 240, 300] as const;

/** Used until the server's snapshot says otherwise. */
export const DEFAULT_TURN_SECONDS = 60;

/** "1 min", "2 min", … — every option is a whole number of minutes. */
export function turnTimerLabel(turnSeconds: number): string {
  return `${turnSeconds / 60} min`;
}

/** Column header letters (used for the classic 5×5 board). */
export const BINGO_HEADER = 'BINGO';

/** A room code is two lowercase words joined by a hyphen. */
export const ROOM_CODE_PATTERN = /^[a-z]+-[a-z]+$/;

/** Auto-advance delay on the Waiting screen (ms). */
export const WAITING_MS = 3200;

/**
 * Avatar accent classes assigned to players by seat index. Literal Tailwind
 * class strings (default palette) so the content scanner emits them. Not custom
 * styling — these are stock utilities used as data.
 */
export const PLAYER_AVATAR_CLASSES = [
  'bg-blue-400',
  'bg-emerald-400',
  'bg-orange-400',
] as const;

export function playerAvatarClass(seatIndex: number): string {
  return PLAYER_AVATAR_CLASSES[seatIndex % PLAYER_AVATAR_CLASSES.length];
}
