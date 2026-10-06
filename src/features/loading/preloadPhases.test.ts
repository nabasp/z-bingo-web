import { describe, expect, it } from 'vitest';
import { CRITICAL_SOUNDS, partitionFailures } from '@/lib/audio/preloadPlan';
import { SOUND_KEYS } from '@/lib/audio/soundRegistry';
import { announcementFor, captionFor, type PreloadState } from './preloadPhases';

function state(overrides: Partial<PreloadState> = {}): PreloadState {
  return {
    phase: 'sounds',
    done: 0,
    total: 28,
    blocking: [],
    tolerable: [],
    ...overrides,
  };
}

describe('CRITICAL_SOUNDS', () => {
  it('names only keys the registry actually has', () => {
    // A typo here would silently never block, which is the one failure mode
    // this set exists to prevent.
    for (const key of CRITICAL_SOUNDS) {
      expect(SOUND_KEYS).toContain(key);
    }
  });

  it('covers the core loop, the clock and the result', () => {
    for (const key of [
      'number_called',
      'number_marked',
      'your_turn',
      'countdown_tick',
      'you_win',
      'you_lose',
    ] as const) {
      expect(CRITICAL_SOUNDS.has(key)).toBe(true);
    }
  });

  it('leaves the cosmetic cues out, so one 404 cannot hold a match open', () => {
    for (const key of ['room_code_copied', 'cell_swap', 'room_created'] as const) {
      expect(CRITICAL_SOUNDS.has(key)).toBe(false);
    }
  });

  it('is a subset, not the whole registry', () => {
    // If everything were critical the distinction would do nothing.
    expect(CRITICAL_SOUNDS.size).toBeLessThan(SOUND_KEYS.length);
  });
});

describe('partitionFailures', () => {
  it('splits what blocks from what does not', () => {
    const { blocking, tolerable } = partitionFailures([
      'number_called',
      'room_code_copied',
    ]);
    expect(blocking).toEqual(['number_called']);
    expect(tolerable).toEqual(['room_code_copied']);
  });

  it('reports nothing for a clean pass', () => {
    expect(partitionFailures([])).toEqual({ blocking: [], tolerable: [] });
  });
});

describe('announcementFor', () => {
  it('says what is happening, once per phase', () => {
    expect(announcementFor(state({ phase: 'sounds' }))).toBe('Loading sounds.');
    expect(announcementFor(state({ phase: 'ready' }))).toBe('Ready.');
  });

  it('never carries the running count', () => {
    // Twenty-eight "n of 28" announcements would interrupt each other the whole
    // way down and tell the listener nothing they can act on.
    const spoken = announcementFor(state({ phase: 'sounds', done: 17 }));
    expect(spoken).not.toContain('17');
    expect(spoken).not.toContain('28');
  });

  it('owns up to what will be silent, without blocking for it', () => {
    expect(
      announcementFor(state({ phase: 'ready', tolerable: ['cell_swap'] })),
    ).toBe('Ready. 1 sound could not be loaded and will be silent.');
  });

  it('says what failed and what to do about it', () => {
    const spoken = announcementFor(
      state({ phase: 'failed', blocking: ['number_called'] }),
    );
    expect(spoken).toContain('could not be loaded');
    expect(spoken).toContain('Retry');
  });
});

describe('captionFor', () => {
  it('carries the count the announcement leaves out', () => {
    expect(captionFor(state({ phase: 'sounds', done: 17, total: 28 }))).toBe(
      'Loading sounds… 17 of 28',
    );
  });

  it('says Ready plainly', () => {
    expect(captionFor(state({ phase: 'ready' }))).toBe('Ready to play');
  });

  it('leaves the count out until there is one worth reading', () => {
    // "0 of 11" on the very first frame reads as broken rather than as
    // starting, and on a warm cache it is the only frame anyone would see.
    expect(captionFor(state({ phase: 'sounds', done: 0 }))).toBe(
      'Loading sounds…',
    );
  });
});
