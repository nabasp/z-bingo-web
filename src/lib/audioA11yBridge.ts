import { announcer } from './a11y/Announcer';
import { audioManager } from './audio/AudioManager';

/**
 * Joins the accessibility and audio subsystems without either importing the
 * other, mirroring `bingo/src/lib/audioA11yBridge.ts`.
 *
 * `a11y/` and `audio/` stay independent on purpose — the announcer needs to duck
 * game audio, and wiring that directly would make the two mutually dependent.
 * This is the single place that knows about both.
 *
 * The native version also syncs screen-reader state into the audio channel
 * defaults. There is no such state to read in a browser (see
 * `audio/webChannels.ts`), so only the ducking half survives.
 *
 * Call once at startup.
 */
export function connectAudioToAccessibility(): () => void {
  announcer.setDucker({
    duck: () => audioManager.duck(),
    unduck: () => audioManager.unduck(),
  });

  return () => announcer.setDucker(null);
}
