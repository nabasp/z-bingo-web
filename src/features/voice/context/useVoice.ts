import { useContext } from 'react';
import { VoiceContext, type VoiceValue } from './voiceContext';

/** The local player's voice connection. Throws outside a {@link VoiceProvider}. */
export function useVoice(): VoiceValue {
  const value = useOptionalVoice();
  if (!value) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return value;
}

/**
 * The same, but null when there is no provider.
 *
 * Play With Bot reuses the board page and deliberately does *not* mount
 * `VoiceProvider` — there is nobody to talk to, and mounting it would have the
 * page ask the server for a LiveKit token in a mode that never talks to the
 * server at all. The voice controls read this and render nothing instead, which
 * is cheaper and safer than a second copy of the board page.
 *
 * Multiplayer always has the provider, so nothing there changes.
 */
export function useOptionalVoice(): VoiceValue | null {
  return useContext(VoiceContext) ?? null;
}
