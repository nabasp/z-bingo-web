import { useContext } from 'react';
import { VoiceContext, type VoiceValue } from './voiceContext';

/** The local player's voice connection. Throws outside a {@link VoiceProvider}. */
export function useVoice(): VoiceValue {
  const value = useContext(VoiceContext);
  if (!value) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return value;
}
