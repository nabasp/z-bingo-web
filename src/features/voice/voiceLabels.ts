import type { VoiceConnection } from './context/voiceContext';

/**
 * What each voice state is called, in words.
 *
 * Shared by the button and the Alt+M shortcut so the two can never describe the
 * same state differently. State is always carried as text, never colour alone.
 */
export const VOICE_LABEL: Record<VoiceConnection, string> = {
  off: 'Voice Off',
  connecting: 'Voice Connecting',
  live: 'Mic On',
  reconnecting: 'Voice Reconnecting',
  denied: 'Mic Blocked',
  unavailable: 'Voice Unavailable',
};

/**
 * Why a press did nothing, for the states where waiting is the only answer.
 *
 * Absent states are retryable — the caller tries again rather than explaining.
 */
export const VOICE_WHY: Partial<Record<VoiceConnection, string>> = {
  connecting: 'Voice chat is still connecting.',
  reconnecting: 'Voice chat is reconnecting. Please wait.',
};
