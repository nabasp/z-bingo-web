import { clearLiveRegions } from './liveRegion';
import { liveRegionSink, type SpeechSink } from './speechSinks';

/**
 * Serialised speech, ported from `bingo-react-native/src/lib/a11y/Announcer.ts`.
 *
 * The mobile version exists because Android's `announceForAccessibility` has no
 * queue — every call cuts off the one before it, and a single room snapshot can
 * produce four things worth saying. **An ARIA live region has the same problem
 * from the other direction:** rewriting its text four times in one tick means a
 * screen reader announces only whatever landed last (or, worse, all four in a
 * pile-up). So the coalescing and pacing carry over unchanged, and only the
 * default sink differs.
 *
 * Three mechanisms fix that:
 *
 * 1. **Coalescing.** Messages raised in the same tick are merged into ONE
 *    utterance, highest priority first. One call, nothing interrupted.
 * 2. **Pacing.** There is no "announcement finished" callback from a screen
 *    reader, so the length of the current utterance is estimated and the next
 *    batch waits for it. A sink that *can* report completion (the self-voicing
 *    one) replaces the estimate with the real thing.
 * 3. **Interruption.** `assertive` messages skip the wait, drop whatever is
 *    pending, and tell the sink to cut off what is in flight.
 *
 * Where the words come out is the sink's business, not this class's — see
 * `speechSinks.ts`.
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
   * Use the same scale as the sound registry so the two stay comparable.
   */
  priority?: number;
  /**
   * Interrupt immediately and discard anything pending. Reserve for things the
   * player must hear now — you won, you lost, connection dropped, or the cell
   * you just moved onto.
   */
  assertive?: boolean;
  /**
   * Collapses repeats. Defaults to the text itself; pass a key when the wording
   * varies but the event doesn't (e.g. a per-second countdown).
   */
  dedupeKey?: string;
  /**
   * How long a repeat is suppressed for. Defaults to `DEDUPE_MS`.
   *
   * **Pass 0 for anything the player drove.** Arrowing from B2 to B3 and back
   * to B2 must say "B2" twice: the dedupe exists to stop the *server* saying
   * the same thing twice in a second, and applying it to navigation turns a
   * fast player's board into silence.
   */
  dedupeMs?: number;
  /**
   * Exempt from the batch character cap.
   *
   * Only for summaries the player explicitly asked for — a whole 8×8 board is
   * 64 numbers and will not fit. They can stop it with any other key, which is
   * what makes the length acceptable; nothing pushed at them may set this.
   */
  allowLong?: boolean;
}

/**
 * The three levels the accessibility spec is written in, as option bundles.
 *
 * Naming them here rather than at each call site is what keeps the hierarchy
 * real: "is this interrupt or notify?" is a question with an answer, whereas
 * "should this be assertive, and what dedupe window?" invites a guess.
 */
export const TIER = {
  /** Grid navigation, call confirmations, wins. Cuts off whatever is playing. */
  interrupt: { assertive: true, dedupeMs: 0 },
  /** Other players' calls, joins and leaves. Waits its turn. */
  notify: { assertive: false },
  /** On-demand readouts: P, R, C, D, X, S and the shortcut help. */
  summary: { assertive: true, dedupeMs: 0, allowLong: true },
} as const satisfies Record<string, SpeakOptions>;

interface Pending {
  text: string;
  priority: number;
  key: string;
  allowLong: boolean;
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
  private sink: SpeechSink = liveRegionSink;
  private unsubscribeDone: (() => void) | null = null;

  /**
   * Wired at startup so game audio drops away while the speech plays. Injected
   * rather than imported so this stays independent of the player.
   */
  setDucker(ducker: Ducker | null): void {
    this.ducker = ducker;
  }

  /**
   * Swap where utterances go. Passing null restores the live-region default.
   *
   * Anything mid-flight on the old sink is cancelled: the two sinks are voices,
   * and leaving one talking while the other starts is the exact pile-up this
   * class exists to prevent.
   */
  setSink(sink: SpeechSink | null): void {
    const next = sink ?? liveRegionSink;
    if (next === this.sink) return;

    this.unsubscribeDone?.();
    this.unsubscribeDone = null;
    this.sink.cancel();
    this.sink = next;
    this.busyUntil = 0;

    // A sink that knows when it has finished beats the character-count guess,
    // which is wrong for every player who has changed their speech rate.
    this.unsubscribeDone = next.onDone?.(() => this.onUtteranceDone()) ?? null;
  }

  speak(text: string, options: SpeakOptions = {}): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const key = options.dedupeKey ?? trimmed;
    const window = options.dedupeMs ?? DEDUPE_MS;
    const now = Date.now();

    if (window > 0) {
      const lastAt = this.lastSpokenAt.get(key) ?? 0;
      if (now - lastAt < window) return;
    }
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
      allowLong: options.allowLong ?? false,
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
      if (!item.allowLong && length + item.text.length > MAX_BATCH_CHARS) break;
      parts.push(item.text);
      length += item.text.length;
    }

    if (parts.length > 0) this.emit(parts.join('. '), false);
  }

  private emit(text: string, interrupt: boolean): void {
    const duration = estimateDurationMs(text);
    this.busyUntil = Date.now() + duration;

    this.ducker?.duck();
    if (this.unduckTimer) clearTimeout(this.unduckTimer);
    this.unduckTimer = setTimeout(() => {
      this.unduckTimer = null;
      this.ducker?.unduck();
    }, duration);

    this.sink.speak(text, { interrupt });
  }

  /**
   * The sink reported a real end-of-utterance, so the estimate can be dropped
   * and anything waiting on it can go now.
   */
  private onUtteranceDone(): void {
    this.busyUntil = 0;
    if (this.unduckTimer) {
      clearTimeout(this.unduckTimer);
      this.unduckTimer = null;
    }
    this.ducker?.unduck();
    if (this.pending.length === 0) return;
    // A flush that already found itself mid-utterance has rescheduled itself
    // for the end of the *estimate*. That timer has to go, or the early
    // wake-up is swallowed by `scheduleFlush`'s "already armed" guard and the
    // real completion signal buys nothing.
    this.cancelFlush();
    this.scheduleFlush(0);
  }

  /** Drop everything pending, e.g. when leaving a screen. */
  clear(): void {
    this.pending = [];
    this.cancelFlush();
    this.sink.cancel();
    // Emptying the regions themselves belongs to a real teardown — a screen
    // being left — not to every interrupting message, hence here and not in
    // `liveRegionSink.cancel`.
    clearLiveRegions();
  }

  /** Full teardown, including dedupe history. Used by tests and on unmount. */
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
