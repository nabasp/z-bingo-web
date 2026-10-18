import { useContext } from 'react';
import type { VoiceStatus } from '@/features/game/types';
import { VoiceParticipantsContext } from '../context/voiceParticipants';

/**
 * One player's microphone state.
 *
 * Call this from the smallest component that renders the state — a leaf badge,
 * not a player card. Everything that subscribes re-renders whenever anybody in
 * the room mutes, so the shallower the subscriber, the more work is skipped.
 *
 * Returns `'mic-off'` outside a provider rather than throwing: the roster is
 * rendered in places where voice is not mounted at all, and a player who is
 * simply not in the call is not an error.
 */
export function useMicState(playerId: string): VoiceStatus {
  const value = useContext(VoiceParticipantsContext);
  return value?.mics.get(playerId) ?? 'mic-off';
}
