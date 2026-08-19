import {
  AUDIO_CHANNELS,
  EMPTY_PREFERENCES,
  type AudioChannel,
  type ChannelPreferences,
} from './audioChannels';
import { loadPreferences, savePreferences } from './channelStorage';
import { resolveWebChannels } from './webChannels';
import { SOUNDS, SOUND_KEYS, type SoundKey } from './soundRegistry';

/**
 * Centralised playback for every game sound — the web engine behind the same
 * API the mobile app's `AudioManager` exposes.
 *
 * `react-native-sound` becomes one `HTMLAudioElement` per key. That mapping is
 * deliberate rather than convenient: an instance per key is what lets different
 * cues overlap while a repeat of the *same* cue restarts instead of stacking on
 * itself, and it is what the whole sound design assumes.
 *
 * Everything the game's feel depends on is preserved: the 120 ms same-key
 * dedupe, priority ordering, `exclusive` win/lose stingers that own the mix for
 * their duration, `delayMs` scheduling, per-clip volume trim, playback `rate`
 * (used by the accelerating turn warning) and ducking under speech.
 *
 * The one genuinely new concern is **autoplay policy**: browsers refuse to play
 * audio until the user has interacted with the page. See `unlock()`.
 */

/**
 * How long the same key is ignored after firing, in ms.
 *
 * A snapshot diff can be evaluated twice for one logical change (React may
 * re-run an effect, and the server sends both `room_updated` and
 * `game_state_updated` for some transitions). Without this, a single call
 * double-triggers and flams.
 */
const DEDUPE_MS = 120;

/** Volume multiplier applied while the screen reader is speaking. */
const DUCK_LEVEL = 0.2;

/** Where the flattened clips live. See `soundRegistry.ts`. */
const AUDIO_BASE_PATH = '/audio/';

/** Fallback when a clip's real duration is not known yet (metadata pending). */
const ASSUMED_DURATION_MS = 1500;

interface LoadedSound {
  element: HTMLAudioElement;
  /** Clip length in ms, used to time the exclusive window. */
  durationMs: number;
}

class AudioManager {
  private loaded = new Map<SoundKey, LoadedSound>();
  private lastPlayedAt = new Map<SoundKey, number>();
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();

  private preferences: ChannelPreferences = { ...EMPTY_PREFERENCES };
  /** Cached so `useSyncExternalStore` sees a stable reference between changes. */
  private channels: Record<AudioChannel, boolean> =
    resolveWebChannels(EMPTY_PREFERENCES);

  private volume = 1;
  private ducked = false;
  private preloaded = false;

  /** False until the player has interacted; see `unlock()`. */
  private unlocked = false;

  /** Epoch ms until which only `exclusive`-priority sounds may play. */
  private exclusiveUntil = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Create every clip's element. Safe to call twice.
   *
   * Deliberately does NOT start downloading: the 28 clips are ~6.5 MB, and the
   * mobile app pays that cost at install time while a browser would pay it on
   * every first visit, competing with the app bundle for a page the visitor may
   * only be signing in to. The elements exist so `play()` has something to talk
   * to; the bytes are fetched from `unlock()`, on the first real interaction.
   */
  preload(): void {
    if (this.preloaded) return;
    this.preloaded = true;

    this.preferences = loadPreferences();
    this.recomputeChannels();

    for (const key of SOUND_KEYS) {
      const element = new Audio(`${AUDIO_BASE_PATH}${SOUNDS[key].file}`);
      element.preload = 'none';
      element.volume = this.effectiveVolume(key);

      const entry: LoadedSound = { element, durationMs: ASSUMED_DURATION_MS };
      element.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(element.duration)) {
          entry.durationMs = element.duration * 1000;
        }
      });
      element.addEventListener('error', () => {
        // A missing or undecodable clip must never take the game down; that
        // key simply becomes a no-op for the rest of the session.
        console.warn(`[audio] failed to load "${SOUNDS[key].file}"`);
        this.loaded.delete(key);
      });

      this.loaded.set(key, entry);
    }
  }

  /**
   * Satisfy the browser's autoplay policy.
   *
   * Chrome, Safari and Firefox all block `play()` until the page has had a real
   * user gesture. Calling `play()` inside the gesture and immediately pausing
   * marks each element as user-activated, so later game-driven cues — which
   * happen nowhere near a click — are allowed through.
   *
   * Until that happens `playNow` is a no-op rather than a source of unhandled
   * rejections. Wired to the first pointer/key event in `main.tsx`.
   */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;

    this.loaded.forEach(({ element }) => {
      // Now that the player is engaged, it is worth having the clips ready.
      element.preload = 'auto';

      const played = element.play();
      if (played && typeof played.then === 'function') {
        played
          .then(() => {
            element.pause();
            element.currentTime = 0;
          })
          .catch(() => {
            // Still blocked — the next real gesture will get another chance.
          });
      }
    });
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  // ── Channels ──────────────────────────────────────────────────────────────

  private recomputeChannels(): void {
    const next = resolveWebChannels(this.preferences);
    const changed = AUDIO_CHANNELS.some(c => next[c] !== this.channels[c]);
    if (!changed) return;

    this.channels = next;
    AUDIO_CHANNELS.forEach(channel => {
      if (!next[channel]) this.stopChannel(channel);
    });
    this.emit();
  }

  /**
   * Kept for API parity with the native manager, where TalkBack state changes
   * the defaults. The web cannot detect a screen reader, so this is inert —
   * `webChannels.ts` explains what replaces it.
   */
  setScreenReaderEnabled(): void {}

  /** An explicit player choice. Sticky from here on. */
  setChannelEnabled(channel: AudioChannel, enabled: boolean): void {
    this.preferences = { ...this.preferences, [channel]: enabled };
    savePreferences(this.preferences);
    this.recomputeChannels();
  }

  toggleChannel(channel: AudioChannel): void {
    this.setChannelEnabled(channel, !this.channels[channel]);
  }

  isChannelEnabled(channel: AudioChannel): boolean {
    return this.channels[channel];
  }

  /** `null` when still on the default. */
  getChannelPreference(channel: AudioChannel): boolean | null {
    return this.preferences[channel];
  }

  getChannels(): Record<AudioChannel, boolean> {
    return this.channels;
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  private channelOf(key: SoundKey): AudioChannel {
    return SOUNDS[key].channel ?? 'sfx';
  }

  private effectiveVolume(key: SoundKey): number {
    return SOUNDS[key].volume * this.volume * (this.ducked ? DUCK_LEVEL : 1);
  }

  /**
   * Play a cue.
   *
   * Drops the sound (rather than queueing it) when its channel is off, when an
   * exclusive stinger outranks it, or when the same key fired moments ago.
   */
  play(key: SoundKey, options: { delayMs?: number; rate?: number } = {}): void {
    const delayMs = options.delayMs ?? 0;
    const rate = options.rate ?? 1;

    if (delayMs > 0) {
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        this.playNow(key, rate);
      }, delayMs);
      this.pendingTimers.add(timer);
      return;
    }
    this.playNow(key, rate);
  }

  private playNow(key: SoundKey, rate = 1): void {
    if (!this.unlocked) return;
    if (!this.channels[this.channelOf(key)]) return;

    const definition = SOUNDS[key];
    const now = Date.now();

    // An exclusive stinger owns the mix until it finishes.
    if (now < this.exclusiveUntil && !definition.exclusive) return;

    const lastAt = this.lastPlayedAt.get(key) ?? 0;
    if (now - lastAt < DEDUPE_MS) return;

    const entry = this.loaded.get(key);
    if (!entry) return;

    this.lastPlayedAt.set(key, now);

    if (definition.exclusive) {
      this.exclusiveUntil = now + entry.durationMs;
      this.stopAll({ except: key });
      this.cancelPending();
    }

    const { element } = entry;
    element.volume = this.effectiveVolume(key);
    element.playbackRate = rate;
    // Restart rather than layer the clip over itself.
    element.currentTime = 0;

    // A rejected play (autoplay policy, or an interrupted load) is expected and
    // must not surface as an unhandled rejection mid-match.
    void element.play().catch(() => undefined);
  }

  /** Global multiplier applied on top of each clip's own trim. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyVolumes();
  }

  private applyVolumes(): void {
    this.loaded.forEach((entry, key) => {
      entry.element.volume = this.effectiveVolume(key);
    });
  }

  // ── Ducking ───────────────────────────────────────────────────────────────

  /** Drop the mix under screen-reader speech. Idempotent. */
  duck(): void {
    if (this.ducked) return;
    this.ducked = true;
    this.applyVolumes();
  }

  unduck(): void {
    if (!this.ducked) return;
    this.ducked = false;
    this.applyVolumes();
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  stopAll(options: { except?: SoundKey } = {}): void {
    this.loaded.forEach((entry, key) => {
      if (key === options.except) return;
      if (entry.element.paused) return;
      entry.element.pause();
      entry.element.currentTime = 0;
    });
  }

  private stopChannel(channel: AudioChannel): void {
    this.loaded.forEach((entry, key) => {
      if (this.channelOf(key) !== channel) return;
      if (entry.element.paused) return;
      entry.element.pause();
      entry.element.currentTime = 0;
    });
  }

  /** Release every element. Pair with `preload()` on teardown. */
  release(): void {
    this.cancelPending();
    this.loaded.forEach(({ element }) => {
      element.pause();
      // Detach the source so the browser can reclaim the buffer.
      element.removeAttribute('src');
      element.load();
    });
    this.loaded.clear();
    this.lastPlayedAt.clear();
    this.exclusiveUntil = 0;
    this.preloaded = false;
  }

  private cancelPending(): void {
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers.clear();
  }

  // ── Subscription, for `useSyncExternalStore` ──────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getChannelsSnapshot = (): Record<AudioChannel, boolean> => this.channels;

  private emit(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const audioManager = new AudioManager();
