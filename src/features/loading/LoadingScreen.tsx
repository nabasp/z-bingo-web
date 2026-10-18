import { useEffect, useRef, useState } from 'react';
import { AppLogo, Button, PageShell } from '@/components/ui';
import { announcer, TIER } from '@/lib/a11y/Announcer';
import { captionFor, type PreloadState } from './preloadPhases';

/**
 * How long loading may take before the progress bar appears, in ms.
 *
 * On a warm cache — which is every visit after the first — the clips settle in
 * a few milliseconds, and a bar that flashed "3 of 11" and vanished would read
 * as a glitch rather than as progress. Below this threshold the player simply
 * gets the title screen with Start on it, which is what they wanted anyway.
 */
const PROGRESS_DELAY_MS = 250;

export interface LoadingScreenProps {
  state: PreloadState;
  /** Reloads only the clips that failed. */
  onRetry: () => void;
  /** Enters the app, and counts as the gesture that unlocks audio. */
  onStart: () => void;
}

/**
 * Shown before any screen, until the game's sounds are in memory.
 *
 * **Nothing here is a live region.** The announcer already owns a pair,
 * mounted before React renders, and every phase change goes through it — a
 * second `role="status"` on this screen would say the same sentence twice, one
 * of them unpaced. So the caption below is plain text for whoever can see it,
 * and `useAppPreload` does the speaking. That split is the same one the rest
 * of the app makes.
 *
 * The progress bar carries the count for anyone who navigates to it
 * deliberately, and is *not* live for the same reason: an update per clip
 * would interrupt itself the whole way down.
 */
export function LoadingScreen({ state, onRetry, onStart }: LoadingScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  /**
   * Arrival: say where we are, and park focus on the heading.
   *
   * The same contract `useAnnounceOnFocus` gives every other screen, but owned
   * here rather than delegated — because that hook parks focus on a 120 ms
   * delay, and this is the one screen in the app that can reach its final
   * state sooner than that. On a warm cache it did: loading finished, focus
   * moved to Start, and then the hook's timer fired and dragged focus back to
   * the heading, leaving a keyboard player pressing Enter on a heading and
   * nothing happening.
   */
  useEffect(() => {
    announcer.speak('Zendalona Bingo. Getting the game ready.', TIER.interrupt);
    headingRef.current?.focus();
  }, []);

  /**
   * Then move focus to whatever the player now has to do.
   *
   * Only on the transition into a settled phase, never on a progress tick —
   * focus that moved once per clip would make the screen unusable. The fetch
   * is asynchronous, so there is always at least one commit in the loading
   * phase before this can fire, and it therefore always runs after the parking
   * above rather than racing it.
   */
  useEffect(() => {
    if (state.phase === 'ready') startRef.current?.focus();
    if (state.phase === 'failed') retryRef.current?.focus();
  }, [state.phase]);

  // Held back so a cached load does not flash a progress bar on its way past.
  const [slowEnoughToShow, setSlowEnoughToShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlowEnoughToShow(true), PROGRESS_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const failed = state.phase === 'failed';
  const ready = state.phase === 'ready';
  const loading = state.phase === 'sounds';
  const percent = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <PageShell center width="narrow">
      {/*
        A fixed minimum height, so the Start button lands in the same place
        whether or not the progress bar was ever shown. Without it a fast load
        moves the button out from under the pointer as the bar disappears.
      */}
      <div className="flex min-h-72 w-full flex-col items-center justify-center gap-5 text-center">
        <AppLogo size="lg" />

        <div className="flex flex-col gap-1">
          {/*
            The app's name, with the screen's purpose in the accessible name
            behind it. Visually this is a title screen; to a screen reader it
            is "Zendalona Bingo, loading the game", which is what someone who
            cannot see the progress bar needs from a heading. The text never
            changes, because focus is parked here and a heading that rewrote
            itself under that focus would be re-read on every phase.
          */}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold text-foreground">
            Zendalona Bingo
            <span className="sr-only">, loading the game</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {failed ? 'Some sounds did not load' : captionFor(state)}
          </p>
        </div>

        {/*
          Only while it is worth showing. `aria-valuetext` because a bare "7"
          read aloud means nothing, and the percentage a screen reader would
          otherwise compute is not what is being counted.
        */}
        {loading && slowEnoughToShow ? (
          <div
            role="progressbar"
            aria-label="Game sounds loaded"
            aria-valuemin={0}
            aria-valuemax={state.total}
            aria-valuenow={state.done}
            aria-valuetext={`${state.done} of ${state.total} sounds loaded`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}

        {failed ? (
          <div className="flex w-full flex-col gap-3">
            <p className="text-sm text-foreground">
              The game needs these to play properly. Check your connection and
              try again.
            </p>
            <Button ref={retryRef} fullWidth onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : null}

        {ready ? (
          <div className="flex w-full flex-col gap-3">
            {state.tolerable.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {state.tolerable.length === 1
                  ? 'One sound'
                  : `${state.tolerable.length} sounds`}{' '}
                could not be loaded and will be silent. Everything else is
                ready.
              </p>
            ) : null}
            {/*
              A real button, not an auto-advance: browsers refuse to play audio
              until the page has had a genuine user gesture, so this press is
              what makes every later cue audible. Pressing it is the only way
              the "Ready" above can be honest.
            */}
            <Button ref={startRef} fullWidth onClick={onStart}>
              Start
            </Button>
            <p className="text-xs text-muted-foreground">
              One press turns the sound on — browsers block audio until then.
            </p>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
