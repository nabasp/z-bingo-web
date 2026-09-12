/**
 * Ported from `bingo/src/features/game/hooks/useGame.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useMemo } from 'react';
import { useAuth } from '@/features/auth/context';
import { useStableArray } from '@/hooks/useStableArray';
import type { Announcement, PlayerProgress } from '../types';
import { DEFAULT_TURN_SECONDS } from '../constants';
import { completedLines, toCells, toUiPlayer } from '../utils';
import { useGameSocket } from '../context';

/**
 * Live gameplay state, projected from the server snapshot.
 *
 * Nothing here is computed authoritatively: marks, letters, turn ownership and
 * the winner all arrive from the server. The client just renders them.
 */
export function useGame() {
  const { user } = useAuth();
  const { room, me, isMyTurn, callNumber, leaveRoom } = useGameSocket();

  // Every socket payload deserialises these afresh, so without stabilising them
  // the board and its completed lines would be rebuilt on every server message
  // — including ones that changed nothing about either.
  const yourBoard = useStableArray(room?.yourBoard);
  const calledNumbers = useStableArray(room?.calledNumbers);

  const board = useMemo(
    () => toCells(yourBoard, calledNumbers ?? []),
    [yourBoard, calledNumbers],
  );

  /** Newest first, for the recent-calls strip. */
  const recentCalls = useMemo(
    () => [...(calledNumbers ?? [])].reverse(),
    [calledNumbers],
  );

  const boardSize = room?.size ?? 5;

  /**
   * Lines completed on your own board, for the strike-through overlay. Derived
   * locally from the same marks the server derives its `letters` count from —
   * a purely visual read of authoritative state, not a second source of truth.
   */
  const lines = useMemo(
    () => completedLines(board, boardSize),
    [board, boardSize],
  );

  const players = useMemo(
    () => (room ? room.players.map(p => toUiPlayer(p, room.hostId, user?.id)) : []),
    [room, user?.id],
  );

  /**
   * The server's own player records, as opposed to the `Player[]` above that
   * the UI components take. The spoken score readout wants `seat` and
   * `letters`, neither of which survives the trip through `toUiPlayer`.
   */
  const seatedPlayers = useMemo(() => room?.players ?? [], [room]);

  const currentPlayer = useMemo(
    () => room?.players.find(p => p.seat === room.currentTurnSeat) ?? null,
    [room],
  );

  /** The most recent call, shown as the headline announcement. */
  const announcement = useMemo<Announcement | null>(() => {
    if (!room || room.callHistory.length === 0) return null;
    const last = room.callHistory[room.callHistory.length - 1];
    const caller = room.players.find(p => p.id === last.playerId);
    const isMine = last.playerId === user?.id;
    return {
      id: `${last.number}-${room.callHistory.length}`,
      number: last.number,
      byName: isMine ? 'You' : caller?.name ?? 'Someone',
      message: 'Check your board!',
    };
  }, [room, user?.id]);

  const progress = useMemo<PlayerProgress[]>(
    () =>
      room
        ? room.players.map(p => ({
            playerId: p.id,
            name: p.id === user?.id ? 'You' : p.name,
            matched: p.letters,
            target: room.size,
          }))
        : [],
    [room, user?.id],
  );

  return {
    room,
    board,
    completedLines: lines,
    players,
    seatedPlayers,
    progress,
    announcement,
    currentPlayer,
    isMyTurn,
    me,
    boardSize,
    word: room?.word ?? 'BINGO',
    recentCalls,
    turnNumber: room?.callHistory.length ?? 0,
    turnEndsAt: room?.turnEndsAt,
    turnSeconds: room?.turnSeconds ?? DEFAULT_TURN_SECONDS,
    callNumber,
    leaveRoom,
  };
}
