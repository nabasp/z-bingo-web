/**
 * Ported from `bingo/src/features/game/hooks/useCreateRoom.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useCallback, useState } from 'react';
import { audioManager } from '@/lib/audio/AudioManager';
import type { BoardSize } from '../types';
import { DEFAULT_TURN_SECONDS } from '../constants';
import { useGameSocket } from '../context';

/**
 * Create Room form state.
 *
 * The room code is issued by the server — the client never invents one.
 */
export function useCreateRoom() {
  const { createRoom } = useGameSocket();
  const [boardSize, setBoardSize] = useState<BoardSize>(5);
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [turnSeconds, setTurnSeconds] = useState<number>(DEFAULT_TURN_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Resolves with the server-issued room code. */
  const submit = useCallback(async (): Promise<string | null> => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const room = await createRoom(boardSize, maxPlayers, turnSeconds);
      // Not derivable from a snapshot diff: the host's first snapshot IS the
      // new room, so `deriveAudioEvents` deliberately stays silent for them.
      audioManager.play('room_created');
      return room.code;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not create the room.',
      );
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [createRoom, boardSize, maxPlayers, turnSeconds]);

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
  };
}
