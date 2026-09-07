import { createContext } from 'react';

/**
 * How the local player's audio connection stands.
 *
 * Split from the participant map on purpose (see `voiceParticipants.ts`): this
 * half changes a handful of times per game, so anything reading it is safe to
 * re-render.
 */
export type VoiceConnection =
  /** Not in a game room, or voice was never attempted. */
  | 'off'
  | 'connecting'
  | 'live'
  /** LiveKit is re-establishing the session by itself. */
  | 'reconnecting'
  /** The player refused the microphone, or the browser blocked it. */
  | 'denied'
  /** Voice is not configured on the server, or the connection failed. */
  | 'unavailable';

export interface VoiceValue {
  connection: VoiceConnection;
  /**
   * A finished, user-facing sentence, or null when there is nothing to say.
   * Rendered in a `Banner` and spoken by the announcer — never assembled at
   * the call site, so the two always agree.
   */
  message: string | null;
  /**
   * Whether the local microphone is publishing.
   *
   * Tracked separately from `connection` so the button stays honest while the
   * session is reconnecting: you are still "unmuted", you are just not
   * currently connected.
   */
  micOn: boolean;
  /** Toggle the microphone. A no-op unless the session is live. */
  toggleMic: () => void;
  /**
   * Try again after a denial or a failure. Safe to call at any time; when the
   * session is already live it does nothing.
   */
  retry: () => void;
}

export const VoiceContext = createContext<VoiceValue | null>(null);
