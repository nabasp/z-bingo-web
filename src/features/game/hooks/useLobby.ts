/**
 * Ported from `bingo/src/features/game/hooks/useLobby.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useMemo } from 'react';
import { useAuth } from '@/features/auth/context';
import { DEFAULT_TURN_SECONDS } from '../constants';
import { useGameSocket } from '../context';
import { toUiPlayer } from '../utils';

/**
 * Lobby state, entirely derived from the server snapshot.
 *
 * Readiness, host identity and whether the game may start are all decided by
 * the server; this hook only projects them for rendering.
 */
export function useLobby() {
  const { user } = useAuth();
  const {
    room,
    me,
    isHost,
    setReady,
    startGame,
    leaveRoom,
    setSize,
    setTurnSeconds,
  } = useGameSocket();

  const players = useMemo(
    () =>
      room
        ? room.players.map(p => toUiPlayer(p, room.hostId, user?.id))
        : [],
    [room, user?.id],
  );

  const youReady = me?.ready ?? false;
  const enoughPlayers = (room?.players.length ?? 0) >= 2;
  const allReady =
    Boolean(room) && enoughPlayers && room!.players.every(p => p.ready);

  return {
    room,
    players,
    maxPlayers: room?.maxPlayers ?? 3,
    boardSize: room?.size ?? 5,
    turnSeconds: room?.turnSeconds ?? DEFAULT_TURN_SECONDS,
    isHost,
    youReady,
    allReady,
    canStart: isHost && allReady,
    toggleReady: () => setReady(!youReady),
    setSize,
    setTurnSeconds,
    startGame,
    leaveRoom,
  };
}
