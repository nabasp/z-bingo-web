import { createContext } from 'react';
import type { VoiceStatus } from '@/features/game/types';

/**
 * Who is in the call, and whether their microphone is open.
 *
 * A separate context from `VoiceContext` for one reason: this is the half that
 * churns. Every mute, unmute, join and leave rewrites it, and folding that into
 * the game's player list would re-render the whole board — including every
 * cell — each time somebody touched their microphone.
 *
 * Keys are Firebase uids, which is exactly what `PublicPlayer.id` holds and
 * what the backend stamps as the LiveKit participant identity. There is no
 * mapping table because there is nothing to map.
 */
export interface VoiceParticipantsValue {
  /** uid → microphone state. A missing key means "not in the call". */
  mics: ReadonlyMap<string, VoiceStatus>;
  /**
   * Who is audibly talking right now, from LiveKit's own speaker detection.
   *
   * Purely decorative — it drives a ripple next to the speaker's name. Nothing
   * about the game depends on it, and no state is conveyed by it alone.
   */
  speaking: ReadonlySet<string>;
}

export const VoiceParticipantsContext =
  createContext<VoiceParticipantsValue | null>(null);
