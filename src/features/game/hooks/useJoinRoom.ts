/**
 * Ported from `bingo/src/features/game/hooks/useJoinRoom.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useCallback, useState } from 'react';
import { mockInvitations } from '../mock';
import { isValidRoomCode, normalizeRoomCode } from '../utils';
import { useGameSocket } from '../context';

/**
 * Join Room state: room-code entry plus placeholder invitations.
 *
 * Local validation is a convenience only — the server re-validates the code
 * and owns membership. Invitations remain mock until a friends backend exists.
 */
export function useJoinRoom() {
  const { joinRoom } = useGameSocket();
  const [code, setCode] = useState('');
  // TODO(invitations): fetch real invitations once the friends API lands.
  const [invitations, setInvitations] = useState(mockInvitations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setNormalizedCode = useCallback((input: string) => {
    setCode(normalizeRoomCode(input));
  }, []);

  const isValid = isValidRoomCode(code);

  const declineInvitation = useCallback((id: string) => {
    setInvitations(prev => prev.filter(inv => inv.id !== id));
  }, []);

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
    invitations,
    declineInvitation,
    submit,
    isSubmitting,
    errorMessage,
  };
}
