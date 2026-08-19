/**
 * Ported from the React Native app: `bingo/src/features/game/audio/turnWarning.ts`.
 * Only the audio-manager import differs; the cadence and rate ramp are identical.
 */

import { audioManager } from '@/lib/audio/AudioManager';

/**
 * The accelerating end-of-turn warning.
 *
 * This replaces the spoken countdown the game used to give ("ten seconds left",
 * "three seconds left"). Speech was a poor urgency signal: each mark cost a full
 * second of the announcer's attention and, with a screen reader running,
 * competed with real game announcements for the same channel. A tick that gets
 * faster and sharper as the deadline approaches carries the same information
 * pre-attentively, costs the announcer nothing, and needs no reading time.
 *
 * Everything here goes through `audioManager.play`, so the warning inherits the
 * `sfx` switch, ducking under screen-reader speech, and suppression while a
 * win/lose stinger owns the mix — no separate accessibility handling required.
 */

/**
 * How much of the tail gets the warning, in seconds.
 *
 * Fixed rather than proportional. At 20% of the turn a five-minute room would
 * tick for a solid minute, which stops reading as urgency and starts reading as
 * noise. A fixed tail means the cue means exactly the same thing in a one-minute
 * room and a five-minute one.
 */
export const WARNING_WINDOW_SECONDS = 10;

interface WarningStep {
  /** Fire while at least this many seconds remain. */
  fromSeconds: number;
  /** Gap to the next tick, in ms. */
  intervalMs: number;
  /** Playback rate for the tick itself. */
  rate: number;
}

/**
 * Cadence and rate ramp together — the gap halves twice while the clip itself
 * sharpens, so the last two seconds feel markedly different from the first few.
 *
 * The fastest cadence (4/s) stays clear of `AudioManager`'s 120 ms dedupe
 * window, so no tick is silently swallowed.
 */
const STEPS: WarningStep[] = [
  { fromSeconds: 6, intervalMs: 1000, rate: 1.1 },
  { fromSeconds: 3, intervalMs: 500, rate: 1.4 },
  { fromSeconds: 0, intervalMs: 250, rate: 1.7 },
];

function stepFor(secondsLeft: number): WarningStep {
  return STEPS.find(s => secondsLeft >= s.fromSeconds) ?? STEPS[STEPS.length - 1];
}

/**
 * Start ticking towards `turnEndsAt`. Returns a cleanup that cancels whatever
 * is still pending.
 *
 * The chain re-reads the clock on every tick and schedules the next one
 * relative to *now*, rather than running off a fixed interval — so a stalled JS
 * thread makes the warning skip ahead instead of drifting past the deadline.
 * Safe to call at any point in a turn: joining late, or reconnecting with the
 * window already gone, simply schedules nothing.
 */
export function startTurnWarning(turnEndsAt: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (delayMs: number) => {
    timer = setTimeout(tick, Math.max(0, delayMs));
  };

  const tick = () => {
    timer = null;
    const msLeft = turnEndsAt - Date.now();
    if (msLeft <= 0) return;

    const secondsLeft = msLeft / 1000;
    const { intervalMs, rate } = stepFor(secondsLeft);
    audioManager.play('countdown_tick', { rate });

    // Never tick past the deadline: `turn_timeout` owns that moment.
    if (msLeft > intervalMs) schedule(intervalMs);
  };

  const untilWindowMs = turnEndsAt - Date.now() - WARNING_WINDOW_SECONDS * 1000;
  if (untilWindowMs > 0) {
    schedule(untilWindowMs);
  } else if (turnEndsAt > Date.now()) {
    // Already inside the window (a mid-turn reconnect) — join in immediately.
    tick();
  }

  return () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}
