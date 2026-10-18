import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announcer, TIER } from './Announcer';
import { publish } from './liveRegion';
import type { SpeechSink } from './speechSinks';

/**
 * Ported from `bingo-react-native/src/lib/a11y/Announcer.test.ts`. Same
 * scheduling contract; the default sink writes into the ARIA live regions
 * rather than calling `announceForAccessibility`, so that is what is observed.
 */
vi.mock('./liveRegion', () => ({
  publish: vi.fn(),
  clearLiveRegions: vi.fn(),
  mountLiveRegions: vi.fn(),
}));

/** What the default sink was asked to announce, in order. */
function spoken(): string[] {
  return vi.mocked(publish).mock.calls.map(([text]) => text);
}

/** Everything the announcer does is timer-driven, so drive the clock by hand. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(publish).mockClear();
  announcer.reset();
});

afterEach(() => {
  announcer.setSink(null);
  announcer.reset();
  vi.useRealTimers();
});

/** Past the coalescing window, so a batch is flushed. */
const flush = () => vi.advanceTimersByTime(100);

describe('announcer', () => {
  it('merges messages raised together into one utterance', () => {
    announcer.speak('Ravi called 42');
    announcer.speak('42 marked on your board');
    flush();

    // One call, not two — Android would have cut the first one off.
    expect(publish).toHaveBeenCalledTimes(1);
    expect(spoken()).toContain('Ravi called 42. 42 marked on your board');
  });

  it('orders a merged batch by priority', () => {
    announcer.speak('low', { priority: 10 });
    announcer.speak('high', { priority: 90 });
    announcer.speak('mid', { priority: 50 });
    flush();

    expect(spoken()).toContain('high. mid. low');
  });

  it('drops a repeat of the same text inside the dedupe window', () => {
    announcer.speak('Your turn');
    flush();
    announcer.speak('Your turn');
    flush();

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('dedupes on an explicit key when the wording changes', () => {
    announcer.speak('5 seconds left', { dedupeKey: 'countdown' });
    flush();
    announcer.speak('4 seconds left', { dedupeKey: 'countdown' });
    flush();

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('waits for the current utterance before speaking the next batch', () => {
    announcer.speak('first message');
    flush();
    expect(publish).toHaveBeenCalledTimes(1);

    announcer.speak('second message');
    flush();
    // Still mid-speech, so the second batch is held rather than interrupting.
    expect(publish).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(spoken().at(-1)).toBe('second message');
  });

  it('lets an assertive message interrupt and discard what was pending', () => {
    announcer.speak('routine update');
    announcer.speak('You win!', { assertive: true });

    // Fires immediately, without waiting for the coalescing window.
    expect(publish).toHaveBeenCalledTimes(1);
    expect(spoken()).toContain('You win!');

    flush();
    // The queued routine message never arrives — it is stale by now.
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('trims a batch rather than speaking a monologue, keeping the important part', () => {
    const long = 'x'.repeat(200);
    announcer.speak(long, { priority: 1 });
    announcer.speak('critical', { priority: 99 });
    announcer.speak(long, { priority: 2, dedupeKey: 'other-long' });
    flush();

    const batch = spoken()[0];
    expect(batch.startsWith('critical')).toBe(true);
    expect(batch.length).toBeLessThanOrEqual(320);
  });

  it('ducks game audio while speaking and restores it after', () => {
    const ducker = { duck: vi.fn(), unduck: vi.fn() };
    announcer.setDucker(ducker);

    announcer.speak('a message');
    flush();
    expect(ducker.duck).toHaveBeenCalledTimes(1);
    expect(ducker.unduck).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(ducker.unduck).toHaveBeenCalledTimes(1);

    announcer.setDucker(null);
  });

  it('says nothing when the text is empty', () => {
    announcer.speak('   ');
    flush();
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('dedupe windows', () => {
  it('suppresses a server repeat by default, which is what the window is for', () => {
    announcer.speak('Your turn');
    flush();
    announcer.speak('Your turn');
    flush();

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('repeats anything the player drove, however fast they drive it', () => {
    // Arrowing B2 -> B3 -> B2 must say "B2" twice. Under the default window the
    // second one vanished and the board fell silent under a fast player.
    announcer.speak('B2, 9, not marked', TIER.interrupt);
    announcer.speak('B3, 3, not marked', TIER.interrupt);
    announcer.speak('B2, 9, not marked', TIER.interrupt);

    expect(publish).toHaveBeenCalledTimes(3);
    expect(spoken().at(-1)).toBe('B2, 9, not marked');
  });

  it('still dedupes an assertive message that asks for a window', () => {
    announcer.speak('The board is not ready yet.', {
      assertive: true,
      dedupeKey: 'shortcut-board',
    });
    announcer.speak('The board is not ready yet.', {
      assertive: true,
      dedupeKey: 'shortcut-board',
    });

    expect(publish).toHaveBeenCalledTimes(1);
  });
});

describe('long summaries', () => {
  const longLine = (label: string) => `${label} ${'9, '.repeat(80)}`;

  it('trims a pushed batch at the character cap, as before', () => {
    announcer.speak(longLine('Row 1:'), { priority: 10 });
    announcer.speak(longLine('Row 2:'), { priority: 5 });
    flush();

    expect(spoken()[0]).not.toContain('Row 2:');
  });

  it('lets a readout the player asked for run to its full length', () => {
    // A whole 8x8 board is 64 numbers; capping it would cut the answer off
    // mid-board, which is worse than a long utterance the player can interrupt.
    const board = longLine('Row 1:') + longLine('Row 2:');
    announcer.speak(board, { allowLong: true });
    flush();

    expect(spoken()).toContain(board.trim());
  });
});

describe('sinks', () => {
  function fakeSink(): SpeechSink & {
    spoken: Array<{ text: string; interrupt: boolean }>;
    cancels: number;
    finish: () => void;
  } {
    let done: (() => void) | null = null;
    return {
      spoken: [],
      cancels: 0,
      speak(text, options) {
        this.spoken.push({ text, interrupt: options.interrupt });
      },
      cancel() {
        this.cancels += 1;
      },
      onDone(callback) {
        done = callback;
        return () => {
          done = null;
        };
      },
      finish() {
        done?.();
      },
    };
  }

  it('sends utterances to an installed sink instead of the live regions', () => {
    const sink = fakeSink();
    announcer.setSink(sink);

    announcer.speak('You win', TIER.interrupt);

    expect(sink.spoken).toEqual([{ text: 'You win', interrupt: true }]);
    expect(publish).not.toHaveBeenCalled();
  });

  it('tells the sink to cut off what is in flight for an interrupting message', () => {
    const sink = fakeSink();
    announcer.setSink(sink);

    announcer.speak('A polite update');
    flush();
    announcer.speak('You win', TIER.interrupt);

    expect(sink.spoken.map(s => s.interrupt)).toEqual([false, true]);
  });

  it('stops the old voice when the sink is swapped, rather than leaving two', () => {
    const sink = fakeSink();
    announcer.setSink(sink);
    announcer.setSink(null);

    expect(sink.cancels).toBeGreaterThan(0);
  });

  it('uses a real end-of-utterance signal in place of the length estimate', () => {
    const sink = fakeSink();
    announcer.setSink(sink);

    announcer.speak('A long first message that would be estimated at seconds');
    flush();
    announcer.speak('The one behind it');
    flush();

    // Still inside the estimated duration, so the second is holding.
    expect(sink.spoken).toHaveLength(1);

    sink.finish();
    flush();

    expect(sink.spoken).toHaveLength(2);
    expect(sink.spoken[1].text).toBe('The one behind it');
  });

  it('goes back to the live regions when the sink is removed', () => {
    const sink = fakeSink();
    announcer.setSink(sink);
    announcer.setSink(null);

    announcer.speak('Back on the live region', TIER.interrupt);

    expect(spoken()).toContain('Back on the live region');
    expect(sink.spoken).toHaveLength(0);
  });
});
