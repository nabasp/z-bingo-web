/**
 * Ported from `bingo/src/features/game/hooks/useWaiting.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useMemo } from 'react';
import { useAuth } from '@/features/auth/context';
import { useGameSocket } from '../context';
import { toUiPlayer } from '../utils';

/**
 * "Waiting for other players" progress.
 *
 * There is no client timer any more — the server flips the room to `playing`
 * once every board is submitted, and navigation follows that status.
 */
export function useWaiting() {
  const { user } = useAuth();
  const { room } = useGameSocket();

  const players = useMemo(
    () => (room ? room.players.map(p => toUiPlayer(p, room.hostId, user?.id)) : []),
    [room, user?.id],
  );

  /** In setup, `ready` means "board submitted". */
  const doneIds = useMemo(
    () =>
      new Set(
        (room?.players ?? []).filter(p => p.ready).map(p => p.id),
      ),
    [room],
  );

  return {
    players,
    doneIds,
    readyCount: doneIds.size,
    totalCount: players.length,
  };
}
