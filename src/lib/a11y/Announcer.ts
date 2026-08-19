import { clearLiveRegions, publish } from './liveRegion';

/**
 * Serialised speech, ported from `bingo/src/lib/a11y/Announcer.ts`.
 *
 * The mobile version exists because Android's `announceForAccessibility` has no
 * queue — every call cuts off the one before it, and a single room snapshot can
 * produce four things worth saying. **An ARIA live region has the same problem
 * from the other direction:** rewriting its text four times in one tick means a
 * screen reader announces only whatever landed last (or, worse, all four in a
 * pile-up). So the coalescing and pacing carry over unchanged, only the output
 * sink differs.
 *
 * 1. **Coalescing.** Messages raised in the same tick merge into ONE utterance,
 *    highest priority first.
 * 2. **Pacing.** There is no "announcement finished" event on the web either, so
 *    the length of the current utterance is estimated and the next batch waits
 *    for it. `assertive` messages skip the wait and drop what is pending.
 */

/** Rough TTS pace. ~18 chars/sec is typical at default screen-reader speed. */
const MS_PER_CHAR = 55;
const MIN_UTTERANCE_MS = 800;
const MAX_UTTERANCE_MS = 8000;

/** How long messages are gathered before being merged and spoken. */
const COALESCE_WINDOW_MS = 60;

/** Identical text inside this window is dropped as a duplicate. */
const DEDUPE_MS = 1000;

/** Guards against a merged batch becoming an unskippable monologue. */
const MAX_BATCH_CHARS = 300;

export interface SpeakOptions {
  /**
   * Higher speaks first within a batch, and wins when the batch is trimmed.
   * Uses the same scale as the sound registry so the two stay comparable.
   */
  priority?: number;
  /**
   * Interrupt immediately and discard anything pending. Reserve for things the
   * player must hear now — you won, you lost, connection dropped.
   */
  assertive?: boolean;
  /**
   * Collapses repeats. Defaults to the text itself; pass a key when the wording
   * varies but the event doesn't.
   */
  dedupeKey?: string;
}

interface Pending {
  text: string;
  priority: number;
  key: string;
}

export interface Ducker {
  duck(): void;
  unduck(): void;
}

function estimateDurationMs(text: string): number {
  return Math.min(
    MAX_UTTERANCE_MS,
    Math.max(MIN_UTTERANCE_MS, text.length * MS_PER_CHAR),
  );
}

class Announcer {
  private pending: Pending[] = [];
  private lastSpokenAt = new Map<string, number>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private unduckTimer: ReturnType<typeof setTimeout> | null = null;

  /** Epoch ms at which the current utterance is estimated to finish. */
  private busyUntil = 0;

  private ducker: Ducker | null = null;

  /**
   * Wired at startup so game audio drops away while the screen reader talks.
   * Injected rather than imported so this stays independent of the player.
   */
  setDucker(ducker: Ducker | null): void {
    this.ducker = ducker;
  }

  speak(text: string, options: SpeakOptions = {}): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const key = options.dedupeKey ?? trimmed;
    const now = Date.now();
    const lastAt = this.lastSpokenAt.get(key) ?? 0;
    if (now - lastAt < DEDUPE_MS) return;
    this.lastSpokenAt.set(key, now);

    if (options.assertive) {
      // Nothing queued behind an assertive message survives it — by the time it
      // would be spoken the player has already moved on.
      this.pending = [];
      this.cancelFlush();
      this.emit(trimmed, true);
      return;
    }

    this.pending.push({
      text: trimmed,
      priority: options.priority ?? 0,
      key,
    });
    this.scheduleFlush(COALESCE_WINDOW_MS);
  }

  private scheduleFlush(delayMs: number): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, delayMs);
  }

  private cancelFlush(): void {
    if (!this.flushTimer) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private flush(): void {
    if (this.pending.length === 0) return;

    // Still mid-utterance: wait it out rather than talking over ourselves.
    const wait = this.busyUntil - Date.now();
    if (wait > 0) {
      this.scheduleFlush(wait);
      return;
    }

    const batch = [...this.pending].sort((a, b) => b.priority - a.priority);
    this.pending = [];

    const seen = new Set<string>();
    const parts: string[] = [];
    let length = 0;

    for (const item of batch) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      // Sorted by priority, so trimming here drops the least important.
      if (length + item.text.length > MAX_BATCH_CHARS) break;
      parts.push(item.text);
      length += item.text.length;
    }

    if (parts.length > 0) this.emit(parts.join('. '), false);
  }

  private emit(text: string, assertive: boolean): void {
    const duration = estimateDurationMs(text);
    this.busyUntil = Date.now() + duration;

    this.ducker?.duck();
    if (this.unduckTimer) clearTimeout(this.unduckTimer);
    this.unduckTimer = setTimeout(() => {
      this.unduckTimer = null;
      this.ducker?.unduck();
    }, duration);

    publish(text, assertive);
  }

  /** Drop everything pending, e.g. when leaving a screen. */
  clear(): void {
    this.pending = [];
    this.cancelFlush();
    clearLiveRegions();
  }

  /** Full teardown, including dedupe history. */
  reset(): void {
    this.clear();
    if (this.unduckTimer) {
      clearTimeout(this.unduckTimer);
      this.unduckTimer = null;
    }
    this.lastSpokenAt.clear();
    this.busyUntil = 0;
    this.ducker?.unduck();
  }
}

export const announcer = new Announcer();
