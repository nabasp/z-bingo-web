import { useContext } from 'react';
import { VoiceParticipantsContext } from '../context/voiceParticipants';

/**
 * Whether this player is audibly talking right now.
 *
 * Call it from the smallest component that shows the effect. Everything that
 * subscribes re-renders whenever anyone starts or stops talking — which during
 * a lively game is often — so the shallower the subscriber, the less work.
 *
 * Returns `false` outside a provider: the roster renders in places where voice
 * is not mounted, and that is not an error.
 */
export function useIsSpeaking(playerId: string): boolean {
  const value = useContext(VoiceParticipantsContext);
  return value?.speaking.has(playerId) ?? false;
}
