/**
 * Ported from `bingo/src/features/game/hooks/useCreateRoom.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useCallback, useState } from 'react';
import { audioManager } from '@/lib/audio/AudioManager';
import { GameRequestError } from '../context';
import type { BoardSize } from '../types';
import { DEFAULT_TURN_SECONDS } from '../constants';
import { useGameSocket } from '../context';

/**
 * Create Room form state.
 *
 * The room code is issued by the server — the client never invents one.
 */
export function useCreateRoom() {
  const { createRoom, joinRoom } = useGameSocket();
  const [boardSize, setBoardSize] = useState<BoardSize>(5);
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [turnSeconds, setTurnSeconds] = useState<number>(DEFAULT_TURN_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /**
   * The room the server says we are already in.
   *
   * One account may hold one active room, so a second create is refused. That
   * is only a good rule if the player can act on it, hence the code: the screen
   * offers to take them back rather than leaving them stuck on a dead end.
   */
  const [existingRoomCode, setExistingRoomCode] = useState<string | null>(null);

  /** Resolves with the server-issued room code. */
  const submit = useCallback(async (): Promise<string | null> => {
    setErrorMessage(null);
    setExistingRoomCode(null);
    setIsSubmitting(true);
    try {
      const room = await createRoom(boardSize, maxPlayers, turnSeconds);
      // Not derivable from a snapshot diff: the host's first snapshot IS the
      // new room, so `deriveAudioEvents` deliberately stays silent for them.
      audioManager.play('room_created');
      return room.code;
    } catch (error) {
      const roomCode = error instanceof GameRequestError ? error.details?.roomCode : undefined;
      if (roomCode) setExistingRoomCode(roomCode);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not create the room.',
      );
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [createRoom, boardSize, maxPlayers, turnSeconds]);

  /** Take the player back to the room they already have open. */
  const rejoinExisting = useCallback(async (): Promise<string | null> => {
    if (!existingRoomCode) return null;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const room = await joinRoom(existingRoomCode);
      setExistingRoomCode(null);
      return room.code;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not rejoin that room.',
      );
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [existingRoomCode, joinRoom]);

  return {
    boardSize,
    setBoardSize,
    maxPlayers,
    setMaxPlayers,
    turnSeconds,
    setTurnSeconds,
    submit,
    isSubmitting,
    errorMessage,
    existingRoomCode,
    rejoinExisting,
  };
}
