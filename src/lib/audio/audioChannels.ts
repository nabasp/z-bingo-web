/**
 * Ported verbatim from the React Native app: `bingo/src/lib/audio/audioChannels.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

/**
 * Per-channel audio preferences — pure logic only.
 *
 * The key idea is that a preference is `boolean | null`, where **`null` means
 * "the player has never said"**. Accessibility-aware defaults apply only while a
 * channel is still `null`; the moment the player flips a switch themselves their
 * choice is sticky forever after.
 *
 * That distinction matters: a blind player who *wants* music must be able to
 * keep it. Force-muting on every screen-reader detection would quietly override
 * them every launch.
 *
 * Persistence lives in `channelStorage.ts` so this file stays free of native
 * imports and directly unit-testable.
 */

export type AudioChannel = 'music' | 'sfx' | 'speech';

export const AUDIO_CHANNELS: AudioChannel[] = ['music', 'sfx', 'speech'];

/** `null` = never explicitly set by the player. */
export type ChannelPreferences = Record<AudioChannel, boolean | null>;

export const EMPTY_PREFERENCES: ChannelPreferences = {
  music: null,
  sfx: null,
  speech: null,
};

/**
 * Default for a channel the player has never set.
 *
 * With a screen reader running, music is the one thing that competes with
 * speech for no functional gain, so it starts off. Effects stay on — they carry
 * real information — but the announcer ducks them while TalkBack talks.
 */
export function defaultFor(
  channel: AudioChannel,
  screenReaderEnabled: boolean,
): boolean {
  switch (channel) {
    case 'music':
      return !screenReaderEnabled;
    case 'sfx':
      return true;
    case 'speech':
      // The app only speaks for itself when a screen reader is absent; with
      // TalkBack on, TalkBack is the voice.
      return screenReaderEnabled;
  }
}

/**
 * Resolve stored preferences into concrete on/off values.
 *
 * Note `??` and not `||` — `false` is a real choice, not an absent one.
 */
export function resolveChannels(
  preferences: ChannelPreferences,
  screenReaderEnabled: boolean,
): Record<AudioChannel, boolean> {
  return {
    music: preferences.music ?? defaultFor('music', screenReaderEnabled),
    sfx: preferences.sfx ?? defaultFor('sfx', screenReaderEnabled),
    speech: preferences.speech ?? defaultFor('speech', screenReaderEnabled),
  };
}

/** Fold a legacy single `muted` flag into the channel model. */
export function migrateLegacyMuted(muted: boolean): ChannelPreferences {
  // A player who muted under the old model chose silence deliberately, so it
  // carries over as an explicit choice on both audible channels.
  return { ...EMPTY_PREFERENCES, sfx: !muted, music: !muted };
}
