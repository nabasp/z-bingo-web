/**
 * Ported from `bingo/src/features/game/hooks/useGameFeedback.ts`.
 * Same logic and same public shape; only import paths differ.
 */

import { useEffect, useRef } from 'react';
import { announcer } from '@/lib/a11y/Announcer';
import { getNotation } from '@/lib/a11y/notation';
import { haptic } from '@/lib/a11y/haptics';
import { audioManager } from '@/lib/audio/AudioManager';
import { useAuth } from '@/features/auth/context';
import { useGameSocket } from '../context';
import { deriveAudioEvents } from '../audio';
import { deriveSpeechEvents } from '../a11y/gameSpeechEvents';
import type { SoundKey } from '@/lib/audio/soundRegistry';
import type { RoomSnapshot } from '../types/events';

/** Which cues are worth a buzz, and which buzz. */
const HAPTICS: Partial<Record<SoundKey, Parameters<typeof haptic>[0]>> = {
  number_marked: 'cellMarked',
  line_complete: 'lineComplete',
  near_win: 'lineComplete',
  your_turn: 'turnStart',
  turn_timeout: 'invalid',
  you_win: 'win',
  you_lose: 'lose',
};

/**
 * Turns changes in the server snapshot into sound, speech and haptics.
 *
 * All three come from **one** diff pass: `deriveAudioEvents` decides what
 * happened, and the speech and haptic layers read its output rather than
 * re-deriving state. That keeps them from ever disagreeing, and avoids running
 * the board scan three times per snapshot.
 *
 * Mounted exactly once, by `GameFeedbackBridge` in `App.tsx`, so cues fire
 * regardless of which screen is on top.
 */
export function useGameFeedback(): void {
  const { user } = useAuth();
  const { room, turnChangeReason } = useGameSocket();
  const previous = useRef<RoomSnapshot | null>(null);

  useEffect(() => {
    const prev = previous.current;
    const audioEvents = deriveAudioEvents(prev, room, user?.id, {
      // The server's own word on why the turn moved, in place of inferring it
      // from the shape of the snapshot.
      turnChangeReason: turnChangeReason ?? undefined,
    });
    const speechEvents = deriveSpeechEvents(prev, room, user?.id, {
      audioEvents,
      // Read here rather than subscribed to: this bridge renders nothing, so a
      // subscription would only add a re-render, and the value is read fresh on
      // every snapshot anyway.
      notation: getNotation(),
    });
    previous.current = room;

    for (const event of audioEvents) {
      audioManager.play(event.key, { delayMs: event.delayMs });
      const feel = HAPTICS[event.key];
      if (feel) haptic(feel);
    }

    // Commentary is opt-out via the `speech` channel. Screen-entry
    // announcements and the cursor's own reads deliberately bypass this — they
    // are how you navigate at all, not colour commentary.
    if (audioManager.isChannelEnabled('speech')) {
      for (const event of speechEvents) {
        announcer.speak(event.text, {
          priority: event.priority,
          assertive: event.assertive,
          dedupeKey: event.dedupeKey,
        });
      }
    }
  }, [room, user?.id, turnChangeReason]);
}
