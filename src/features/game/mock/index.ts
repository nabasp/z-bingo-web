/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/mock/index.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import type { RecentGame } from '../types';

/**
 * Remaining placeholder data.
 *
 * Live room, player, board, turn and result state come from the server via
 * `GameSocketProvider`, and invitations now come from `features/social` — the
 * mocks for both were removed. What's left is the one feature with no backend.
 *
 * TODO(history): serve real recent games once match history is stored.
 */

export const mockRecentGames: RecentGame[] = [
  { id: 'rg-1', outcome: 'won', players: 3, when: 'Today' },
  { id: 'rg-2', outcome: 'lost', players: 2, when: 'Yesterday' },
];
