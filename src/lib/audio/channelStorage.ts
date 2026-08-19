import {
  EMPTY_PREFERENCES,
  migrateLegacyMuted,
  type ChannelPreferences,
} from './audioChannels';

/**
 * Channel-preference persistence.
 *
 * Same keys and same shape as the mobile app
 * (`bingo/src/lib/audio/channelStorage.ts`), with `localStorage` in place of
 * AsyncStorage — so the semantics that matter are preserved: a preference is
 * `boolean | null`, and `null` means "the player has never said", which is what
 * lets a default apply without ever overriding a real choice.
 *
 * Synchronous here (the native version is async), which is why `loadPreferences`
 * returns a value rather than a promise.
 */

const STORAGE_KEY = 'bingo.audio.channels';

/** Pre-channel key, migrated on first load so existing players aren't reset. */
const LEGACY_MUTED_KEY = 'bingo.audio.muted';

/**
 * Deliberately failure-tolerant: audio settings are never important enough to
 * break a launch over, so any storage problem (private mode, blocked cookies,
 * corrupt JSON) falls back to defaults.
 */
export function loadPreferences(): ChannelPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_PREFERENCES, ...(JSON.parse(raw) as object) };

    const legacy = localStorage.getItem(LEGACY_MUTED_KEY);
    if (legacy === null) return { ...EMPTY_PREFERENCES };

    const migrated = migrateLegacyMuted(legacy === 'true');
    savePreferences(migrated);
    localStorage.removeItem(LEGACY_MUTED_KEY);
    return migrated;
  } catch {
    return { ...EMPTY_PREFERENCES };
  }
}

/** Fire-and-forget; callers have already updated their in-memory copy. */
export function savePreferences(preferences: ChannelPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Non-fatal.
  }
}
