import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announcer } from '@/lib/a11y';
import { audioManager } from '@/lib/audio/AudioManager';
import { CRITICAL_SOUNDS } from '@/lib/audio/preloadPlan';
import { SOUND_KEYS } from '@/lib/audio/soundRegistry';
import { AppLoadingGate } from './AppLoadingGate';

/**
 * The gate's contract, which is mostly about what a blind player receives.
 *
 * The bug it exists for was mundane — the first cue of a match could still be
 * downloading when it was asked to play — but the fix puts a screen in front
 * of everything, and a loading screen is exactly the sort of thing that ships
 * without a heading, without focus management, and announcing its progress
 * twenty-eight times.
 */

/**
 * Serve the clips, choosing which of them 404.
 *
 * `testSetup` serves them all so the rest of the suite can get past the gate;
 * here we need per-clip control, and the count of requests, because "retries
 * only what failed" is otherwise unobservable.
 */
let requested: string[] = [];

function stubLoading(failures: string[] = []) {
  requested = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (failures.some(file => url.includes(file))) {
      return new Response(null, { status: 404 });
    }
    return new Response(new Blob([new Uint8Array(8)]), { status: 200 });
  });
}

beforeEach(() => {
  // Each test starts from a manager with no elements and no verdicts.
  audioManager.release();
  stubLoading();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  audioManager.release();
  stubLoading();
});

function renderGate() {
  return render(
    <AppLoadingGate>
      <p>Game screen</p>
    </AppLoadingGate>,
  );
}

describe('AppLoadingGate', () => {
  it('shows nothing behind it until the player presses Start', async () => {
    renderGate();

    expect(screen.queryByText('Game screen')).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(screen.getByText('Game screen')).toBeInTheDocument();
  });

  it('unlocks audio on that press, because browsers require a real gesture', async () => {
    // Without this the first in-game cue is the one that discovers the page
    // was never unlocked, which is silence at the worst possible moment.
    //
    // Spied rather than read back from `isUnlocked`: a page's user-activation
    // state is not something `release()` undoes, so by the second test in this
    // file the flag is already set and would prove nothing.
    const unlock = vi.spyOn(audioManager, 'unlock');
    renderGate();

    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('blocks on a critical clip and offers Retry', async () => {
    stubLoading(['number_called.m4a']);
    renderGate();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(retry).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.queryByText('Game screen')).toBeNull();
  });

  it('lets a cosmetic clip fail without holding the game up', async () => {
    // Blocking a match the server has already started because a copy-code
    // chime 404'd would be worse than the delay this system removes.
    stubLoading(['room_code_copied.m4a']);
    renderGate();

    // Ready first — a cosmetic clip is not even in the pass the gate waits on.
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    // Then the background pass reports it, without taking Start away.
    expect(await screen.findByText(/will be silent/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('recovers when a retry succeeds', async () => {
    stubLoading(['number_called.m4a']);
    renderGate();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    stubLoading();
    fireEvent.click(retry);

    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('asks for the clips a game cannot start without first, and the rest after', async () => {
    // The gate used to hold the whole app on all 28. On a slow connection that
    // is the difference between waiting for 11 clips and 28.
    //
    // Asserted as an ordering rather than a count at the moment Start appears:
    // in jsdom both passes settle in the same microtask queue, so a count
    // would be timing-dependent. The ordering is the actual invariant.
    renderGate();
    await screen.findByRole('button', { name: 'Start' });
    await waitFor(() => expect(requested.length).toBe(SOUND_KEYS.length));

    const keyOf = (url: string) => url.split('/').pop()!.replace('.m4a', '');
    const front = requested.slice(0, CRITICAL_SOUNDS.size).map(keyOf);
    const back = requested.slice(CRITICAL_SOUNDS.size).map(keyOf);

    expect(new Set(front)).toEqual(new Set(CRITICAL_SOUNDS));
    expect(back.some(key => CRITICAL_SOUNDS.has(key as never))).toBe(false);
  });

  it('retries only what failed', async () => {
    stubLoading(['number_called.m4a']);
    renderGate();
    const retry = await screen.findByRole('button', { name: 'Retry' });

    // Counting from here: a retry that re-fetched all 28 would be paying again
    // for the 27 already sitting in memory.
    stubLoading();
    fireEvent.click(retry);
    await screen.findByRole('button', { name: 'Start' });

    expect(requested).toEqual([
      expect.stringContaining('number_called.m4a'),
    ]);
  });

  it('asks for each clip once, even under StrictMode double mounting', async () => {
    render(
      <StrictMode>
        <AppLoadingGate>
          <p>Game screen</p>
        </AppLoadingGate>
      </StrictMode>,
    );
    await screen.findByRole('button', { name: 'Start' });

    expect(new Set(requested).size).toBe(requested.length);
  });
});

describe('AppLoadingGate accessibility', () => {
  it('has a heading that says what is happening', async () => {
    // Visually a title screen; to a screen reader it still says which screen
    // this is, which is what someone who cannot see the bar needs.
    renderGate();
    expect(
      screen.getByRole('heading', { name: /loading the game/i }),
    ).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Start' });
  });

  it('does not flash a progress bar on a warm cache', async () => {
    // Every visit after the first settles in a few milliseconds. A bar that
    // appeared and vanished in that time reads as a glitch, not as progress.
    renderGate();
    await screen.findByRole('button', { name: 'Start' });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('exposes progress without making it a live region, once there is some', async () => {
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    vi.stubGlobal('fetch', async () => {
      await held;
      return new Response(new Blob([new Uint8Array(8)]), { status: 200 });
    });

    renderGate();

    const bar = await screen.findByRole(
      'progressbar',
      { name: 'Game sounds loaded' },
      { timeout: 2000 },
    );
    // A live progress bar would re-announce on every clip.
    expect(bar).not.toHaveAttribute('aria-live');
    // "7" alone is meaningless read aloud; the value text is what is spoken.
    expect(bar).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('sounds loaded'),
    );

    release();
    await screen.findByRole('button', { name: 'Start' });
  });

  it('announces each phase once, and never the running count', async () => {
    const speak = vi.spyOn(announcer, 'speak');
    renderGate();
    await screen.findByRole('button', { name: 'Start' });

    const spoken = speak.mock.calls.map(call => String(call[0]));
    expect(spoken.filter(line => line === 'Loading sounds.')).toHaveLength(1);
    expect(spoken.filter(line => line.startsWith('Ready'))).toHaveLength(1);
    expect(spoken.some(line => /\d+ of \d+/.test(line))).toBe(false);
  });

  it('moves focus to the action the player now has, and keeps it', async () => {
    // The regression: the screen's arrival used to park focus on the heading
    // after a 120 ms delay, which on a warm cache fired *after* loading had
    // finished and dragged focus off the button — leaving a keyboard player
    // pressing Enter on a heading.
    renderGate();
    const start = await screen.findByRole('button', { name: 'Start' });
    await waitFor(() => expect(start).toHaveFocus());

    await new Promise(resolve => setTimeout(resolve, 200));
    expect(start).toHaveFocus();
  });

  it('moves focus to Retry when loading fails', async () => {
    stubLoading(['number_called.m4a']);
    renderGate();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    await waitFor(() => expect(retry).toHaveFocus());
  });
});
