/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/mock/index.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import type { Invitation, RecentGame } from '../types';

/**
 * Remaining placeholder data.
 *
 * Live room, player, board, turn and result state now come from the server via
 * `GameSocketProvider` — the mocks for those were removed. What's left are the
 * two features with no backend yet.
 *
 * TODO(invitations): serve real invitations once friends/invites exist.
 * TODO(history): serve real recent games once match history is stored.
 */

export const mockInvitations: Invitation[] = [
  {
    id: 'inv-1',
    fromName: 'Alex',
    roomLabel: "Alex's Room",
    roomCode: 'lucky-falcon',
    boardSize: 5,
    players: 2,
    timeAgo: '2m ago',
  },
  {
    id: 'inv-2',
    fromName: 'Sam',
    roomLabel: "Sam's Room",
    roomCode: 'sunny-panda',
    boardSize: 4,
    players: 3,
    timeAgo: '15m ago',
  },
];

export const mockRecentGames: RecentGame[] = [
  { id: 'rg-1', outcome: 'won', players: 3, when: 'Today' },
  { id: 'rg-2', outcome: 'lost', players: 2, when: 'Yesterday' },
];
