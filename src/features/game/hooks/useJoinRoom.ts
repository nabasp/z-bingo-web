/**
 * Ported from `bingo/src/features/game/hooks/useJoinRoom.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useCallback, useState } from 'react';
import { isValidRoomCode, normalizeRoomCode } from '../utils';
import { useGameSocket } from '../context';

/**
 * Join Room state: room-code entry.
 *
 * Local validation is a convenience only — the server re-validates the code
 * and owns membership. Invitations are not here any more: a real one arrives
 * as a modal from `features/social`, wherever the player happens to be.
 */
export function useJoinRoom() {
  const { joinRoom } = useGameSocket();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setNormalizedCode = useCallback((input: string) => {
    setCode(normalizeRoomCode(input));
  }, []);

  const isValid = isValidRoomCode(code);

  /** Resolves with the joined room code, or null when the join failed. */
  const submit = useCallback(
    async (roomCode: string): Promise<string | null> => {
      setErrorMessage(null);
      setIsSubmitting(true);
      try {
        const room = await joinRoom(roomCode);
        return room.code;
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not join the room.',
        );
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [joinRoom],
  );

  return {
    code,
    setCode: setNormalizedCode,
    isValid,
    submit,
    isSubmitting,
    errorMessage,
  };
}
