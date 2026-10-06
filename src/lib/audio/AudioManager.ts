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

/**
 * The registry names the mobile app's WAV; the web serves AAC.
 *
 * `soundRegistry.ts` is shared verbatim with the mobile app, where the clips
 * are on the device already and 48 kHz PCM costs nothing. On the web every
 * byte crosses a network before the first cue can play, and the same 33
 * seconds of audio is 6.2 MB as PCM against 564 KB as AAC. Translating the
 * extension here keeps that difference out of the shared file entirely —
 * `audio-src/` holds the originals, `scripts/encode-audio.sh` produces what
 * ships, and neither app has to know about the other's format.
 */
function webSource(file: string): string {
  return `${AUDIO_BASE_PATH}${file.replace(/\.wav$/, '.m4a')}`;
}

/** Fallback when a clip's real duration is not known yet (metadata pending). */
const ASSUMED_DURATION_MS = 1500;

/**
 * How long one clip may take before it counts as failed, in ms.
 *
 * A request that never settles would otherwise hold the loading screen open
 * for ever. Generous, because this is a ceiling for a stalled connection and
 * not a budget — a clip that is simply slow must not be failed out from under
 * a player on a poor connection.
 */
const CLIP_TIMEOUT_MS = 30_000;

interface LoadedSound {
  element: HTMLAudioElement;
  /** Clip length in ms, used to time the exclusive window. */
  durationMs: number;
  /**
   * The clip could not be fetched or decoded.
   *
   * Kept in the map rather than deleted, which is what makes a retry possible:
   * the element is reusable, so reloading costs no new instance and no new
   * listeners. `playNow` skips a failed entry, so the key is still a silent
   * no-op for as long as it stays broken.
   */
  failed: boolean;
  /**
   * The `blob:` URL the element plays from once the bytes are in memory.
   *
   * Set means fetched: the clip needs no network and no cache lookup to play.
   * Revoked in `release()`, which is the only thing keeping 6.2 MB of blobs
   * from outliving the manager.
   */
  objectUrl?: string;
}

/** What one preload pass managed to fetch. */
export interface AudioLoadReport {
  loaded: SoundKey[];
  failed: SoundKey[];
  /**
   * The pass was torn down by `release()` rather than finishing.
   *
   * Its verdicts mean nothing and must not be shown to anyone: an abort the
   * app caused is not a failure the player needs to hear about. Without this,
   * React's development double-mount tore down the first pass and the loading
   * screen announced that eleven game sounds had failed — a sentence a blind
   * player has no way to check and every reason to believe.
   */
  cancelled: boolean;
}

export interface FetchAllOptions {
  /** Defaults to every key. A retry passes just the ones that failed. */
  keys?: readonly SoundKey[];
  /** Called as each clip settles, ready or not. */
  onProgress?: (done: number, total: number) => void;
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

  /**
   * The pass currently fetching clips, if any.
   *
   * One promise shared by every concurrent caller, so a double-mounted effect
   * — which `StrictMode` guarantees in development — issues one set of
   * requests rather than two.
   */
  private fetching: Promise<AudioLoadReport> | null = null;

  /** Open requests, so `release()` can abort rather than orphan them. */
  private inFlight = new Set<AbortController>();

  /** Bumped by `release()`, so a pass can tell it has been superseded. */
  private generation = 0;

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
      const element = new Audio(webSource(SOUNDS[key].file));
      element.preload = 'none';
      element.volume = this.effectiveVolume(key);

      const entry: LoadedSound = {
        element,
        durationMs: ASSUMED_DURATION_MS,
        failed: false,
      };
      element.addEventListener('loadedmetadata', () => {
        entry.failed = false;
        if (Number.isFinite(element.duration)) {
          entry.durationMs = element.duration * 1000;
        }
      });
      element.addEventListener('error', () => {
        // A missing or undecodable clip must never take the game down; that
        // key becomes a no-op until something reloads it. Flagged rather than
        // deleted, so `fetchAll` can be asked to try this one again without
        // building a second element for the same key.
        console.warn(`[audio] failed to load "${SOUNDS[key].file}"`);
        entry.failed = true;
      });

      this.loaded.set(key, entry);
    }
  }

  /**
   * Fetch and decode the clips, and report what did not make it.
   *
   * `preload()` creates the elements but deliberately pulls no bytes; this is
   * the half that does, and it is what a loading screen waits on. Resolving
   * means every listed clip reached `HAVE_ENOUGH_DATA` — the first `play()`
   * will be a decode-and-go, not a network round trip, which is the entire
   * point of the exercise.
   *
   * Safe to call concurrently: callers share one pass. Safe to call again
   * afterwards: an already-buffered clip settles synchronously, so a retry
   * costs a request only for the clips that need one, and a warm cache adds
   * no delay at all.
   */
  fetchAll(options: FetchAllOptions = {}): Promise<AudioLoadReport> {
    if (this.fetching) return this.fetching;

    this.preload();

    const keys = options.keys ?? SOUND_KEYS;
    const total = keys.length;
    const generation = this.generation;
    let done = 0;

    const run = async (): Promise<AudioLoadReport> => {
      const results = await Promise.all(
        keys.map(async key => {
          const ok = await this.fetchOne(key);
          done += 1;
          // A superseded pass stops reporting progress too, or a torn-down
          // screen would keep counting up behind the one that replaced it.
          if (generation === this.generation) options.onProgress?.(done, total);
          return [key, ok] as const;
        }),
      );

      return {
        loaded: results.filter(([, ok]) => ok).map(([key]) => key),
        failed: results.filter(([, ok]) => !ok).map(([key]) => key),
        cancelled: generation !== this.generation,
      };
    };

    this.fetching = run().finally(() => {
      // Cleared on settle rather than kept, so a retry is a fresh pass rather
      // than a second subscription to the one that already failed.
      this.fetching = null;
    });

    return this.fetching;
  }

  /** Whether a clip's bytes are in memory, so `play()` waits on nothing. */
  isReady(key: SoundKey): boolean {
    const entry = this.loaded.get(key);
    return Boolean(entry && !entry.failed && entry.objectUrl);
  }

  /**
   * One clip, fetched into memory and handed to its element.
   *
   * **Fetched rather than preloaded through the element**, which is the one
   * decision here worth defending. Setting `preload="auto"` and waiting for
   * `canplaythrough` reads like the obvious approach and works in Chrome, but
   * iOS Safari ignores `preload` outright and will not touch the network until
   * `play()` is called — so the event never arrives, every clip times out, and
   * a perfectly healthy iPhone is told the game failed to load. `fetch` has
   * the same behaviour in every browser, reports a real HTTP status so a 404
   * is a failure rather than a silence, and is abortable.
   *
   * The bytes become a `blob:` URL, so the first `play()` reads from memory:
   * no second request, and no dependence on cache headers to avoid one.
   */
  private async fetchOne(key: SoundKey): Promise<boolean> {
    const entry = this.loaded.get(key);
    if (!entry) return false;

    // Already in memory — a second pass over a key that is done, or a retry
    // that swept one up alongside the clip that actually failed. No request,
    // and no artificial wait before the loading screen can move on.
    if (entry.objectUrl) {
      entry.failed = false;
      return true;
    }

    const { file } = SOUNDS[key];
    const controller = new AbortController();
    this.inFlight.add(controller);
    const timer = setTimeout(() => controller.abort(), CLIP_TIMEOUT_MS);

    try {
      const response = await fetch(webSource(file), {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const url = URL.createObjectURL(await response.blob());
      entry.objectUrl = url;
      entry.element.src = url;
      entry.element.preload = 'auto';
      // Best-effort decode warming. Not awaited: the bytes are already local,
      // so whether the element has finished decoding is the difference between
      // instant and very nearly instant — not worth a second event to wait on,
      // and not worth failing a clip over.
      entry.element.load();
      entry.failed = false;
      return true;
    } catch (error) {
      // An abort is a teardown, not a broken clip. Leaving `failed` alone
      // keeps the entry usable by whatever pass comes next.
      if (controller.signal.aborted) return false;
      console.warn(`[audio] failed to load "${file}":`, error);
      entry.failed = true;
      return false;
    } finally {
      clearTimeout(timer);
      this.inFlight.delete(controller);
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
    // A clip that failed to load stays in the map so it can be retried, but it
    // has nothing to play until it is.
    if (!entry || entry.failed) return;

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
    this.generation += 1;
    this.inFlight.forEach(controller => controller.abort());
    this.inFlight.clear();
    this.loaded.forEach(entry => {
      const { element } = entry;
      element.pause();
      // Detach the source so the browser can reclaim the buffer, and hand the
      // blob back — 6.2 MB of clips would otherwise outlive the manager.
      element.removeAttribute('src');
      element.load();
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
        entry.objectUrl = undefined;
      }
    });
    this.loaded.clear();
    this.lastPlayedAt.clear();
    this.exclusiveUntil = 0;
    this.preloaded = false;
    this.fetching = null;
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
