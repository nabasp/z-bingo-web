import { publish } from './liveRegion';

/**
 * Where an utterance actually goes.
 *
 * The `Announcer` decides *what* to say and *when*; a sink decides *how* it is
 * voiced. Splitting the two is what lets the app speak for itself — see
 * `speechEngine.ts` — without the queueing, coalescing and pacing rules being
 * written twice.
 *
 * The mobile app keeps a copy at `bingo-react-native/src/lib/a11y/speechSinks.ts`
 * with the same interface and a different default; only the sink differs, which
 * is the whole point of the seam.
 */
export interface SpeechSink {
  /**
   * `interrupt` means the player is waiting on this one: cut off whatever is
   * in flight. A sink that cannot interrupt should still speak.
   */
  speak(text: string, options: { interrupt: boolean }): void;
  /** Stop anything in flight and drop anything queued inside the sink. */
  cancel(): void;
  /**
   * Subscribe to real end-of-utterance events, returning an unsubscribe.
   * Optional: a sink with no such signal leaves the announcer on its
   * character-count estimate.
   */
  onDone?(callback: () => void): () => void;
}

/**
 * The default: write into the hidden ARIA live regions and let the screen
 * reader speak.
 *
 * Nothing here can truly interrupt — the screen reader owns its own queue, and
 * `aria-live="assertive"` is a request, not a guarantee. What the announcer can
 * do is stop *adding* to the pile, which is what `interrupt` routes to here.
 * A player who wants genuine barge-in wants `speechEngine`.
 */
export const liveRegionSink: SpeechSink = {
  speak(text, { interrupt }) {
    publish(text, interrupt);
  },
  cancel() {
    // Deliberately not `clearLiveRegions()`. Emptying a region a screen reader
    // is mid-way through announcing is, on several of them, a second content
    // change and so a second announcement — the opposite of cancelling.
    // `Announcer.clear()` calls that separately when a screen is actually torn
    // down.
  },
};
