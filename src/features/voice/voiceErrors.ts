import type { VoiceConnection } from './context/voiceContext';

/**
 * Every way voice can fail, in words a player can act on.
 *
 * Kept in one table rather than scattered across the provider so the wording
 * can be read — and reviewed — as a set. Two rules hold throughout: say what
 * the player can do about it, and never imply the game itself is broken,
 * because it never is. Audio is the only thing at stake.
 */
export interface VoiceFailure {
  connection: VoiceConnection;
  message: string;
  /** Interrupt the screen reader. Reserved for things needing a decision. */
  assertive: boolean;
}

const DENIED: VoiceFailure = {
  connection: 'denied',
  message: 'Microphone access was refused. Choose Voice to try again.',
  assertive: true,
};

const NO_DEVICE: VoiceFailure = {
  connection: 'unavailable',
  message: 'No microphone was found. You can still hear the other players.',
  assertive: false,
};

const BUSY: VoiceFailure = {
  connection: 'unavailable',
  message: 'Your microphone is in use by another app.',
  assertive: true,
};

const FAILED: VoiceFailure = {
  connection: 'unavailable',
  message: 'Could not connect to voice chat. Choose Voice to try again.',
  assertive: false,
};

/** The server has no LiveKit configured. Not an error — a deployment choice. */
export const VOICE_DISABLED: VoiceFailure = {
  connection: 'unavailable',
  message: 'Voice chat is not available right now. The game works as usual.',
  assertive: false,
};

/**
 * Classify a thrown value into something sayable.
 *
 * `getUserMedia` reports its failures through `DOMException.name`, which is the
 * only reliable discriminator — the messages differ per browser. The server's
 * own refusal arrives as a `GameRequestError` carrying `voice_unavailable`.
 */
export function classifyVoiceError(error: unknown): VoiceFailure {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'voice_unavailable') return VOICE_DISABLED;

  const name = (error as { name?: unknown } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return DENIED;
    case 'NotFoundError':
    case 'OverconstrainedError':
      return NO_DEVICE;
    case 'NotReadableError':
    case 'AbortError':
      return BUSY;
    default:
      return FAILED;
  }
}
