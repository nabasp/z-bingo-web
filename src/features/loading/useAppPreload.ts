import { useCallback, useEffect, useRef, useState } from 'react';
import { announcer, TIER } from '@/lib/a11y/Announcer';
import { audioManager } from '@/lib/audio/AudioManager';
import { partitionFailures, splitByUrgency } from '@/lib/audio/preloadPlan';
import { SOUND_KEYS, type SoundKey } from '@/lib/audio/soundRegistry';
import { announcementFor, type PreloadState } from './preloadPhases';

const INITIAL: PreloadState = {
  phase: 'sounds',
  done: 0,
  total: splitByUrgency(SOUND_KEYS).first.length,
  blocking: [],
  tolerable: [],
};

export interface AppPreload {
  state: PreloadState;
  /** Reloads only the clips that failed. */
  retry: () => void;
}

/**
 * Fetch what the game needs before any screen is shown, and the rest behind it.
 *
 * The delay this removes was real and had a single cause: `preload()` builds
 * the audio elements but sets `preload="none"`, so nothing was fetched until
 * the first click — and the first cue of a match could still be downloading
 * when it was asked to play.
 *
 * **Two passes.** The gate waits only on the clips a game cannot start without
 * (`CRITICAL_SOUNDS`); everything else is fetched once the player is already
 * in, where a lobby chime arriving a second late costs nothing. On a slow
 * connection that is the difference between waiting for 11 clips and 28.
 *
 * Retries reuse the same elements, so nothing here can accumulate a second
 * `Audio` instance, a duplicate listener or a stray timer; see
 * `AudioManager.fetchOne`, which removes its listeners and its timeout on
 * every path out.
 */
export function useAppPreload(): AppPreload {
  const [state, setState] = useState<PreloadState>(INITIAL);

  /**
   * Live for as long as the gate is mounted.
   *
   * The background pass routinely outlives it — the player presses Start and
   * the lobby chimes are still arriving — so a settled pass must check before
   * it touches state, and must never announce anything for a screen that is
   * no longer there.
   */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Fetch a set of clips, reporting progress only if asked to. */
  const fetch = useCallback(
    (keys: readonly SoundKey[], options: { visible: boolean }) =>
      audioManager.fetchAll({
        keys,
        onProgress: (done, total) => {
          if (!options.visible || !mounted.current) return;
          setState(previous => ({ ...previous, done, total }));
        },
      }),
    [],
  );

  const run = useCallback(
    (keys: readonly SoundKey[]) => {
      const { first, rest } = splitByUrgency(keys);

      void fetch(first, { visible: true }).then(report => {
        // Torn down, not finished: the verdicts belong to a pass that no
        // longer exists, and announcing them would be telling a player their
        // sounds failed when nothing did.
        if (report.cancelled) return;

        const { blocking, tolerable } = partitionFailures(report.failed);
        if (mounted.current) {
          setState(previous => ({
            ...previous,
            phase: blocking.length > 0 ? 'failed' : 'ready',
            done: first.length,
            total: first.length,
            blocking,
            tolerable: [...previous.tolerable, ...tolerable],
          }));
        }

        // Nothing else is fetched while the game is unplayable: a retry is
        // coming, and it should have the whole connection.
        if (blocking.length > 0 || rest.length === 0) return;

        void fetch(rest, { visible: false }).then(late => {
          if (late.cancelled || !mounted.current) return;
          // Only the non-blocking half can fail here, and it only changes the
          // "will be silent" line — the player is already past this screen in
          // every case but the slowest.
          setState(previous => ({
            ...previous,
            tolerable: [
              ...previous.tolerable,
              ...partitionFailures(late.failed).tolerable,
            ],
          }));
        });
      });
    },
    [fetch],
  );

  /**
   * One pass on mount, and no `setState` in the effect body.
   *
   * The initial state is already `'sounds'` because that is what this hook
   * does the moment it exists — a "starting" phase would last zero frames and
   * cost a cascading render to leave.
   *
   * `fetchAll` shares a single in-flight promise, so StrictMode's double
   * invocation issues one set of requests rather than two.
   */
  useEffect(() => {
    run(SOUND_KEYS);
  }, [run]);

  /**
   * Announce the phase, and only when it changes.
   *
   * In an effect because speaking is exactly the sort of external-system
   * synchronisation effects are for, and keyed on the phase alone: progress is
   * deliberately never announced. Twenty-eight "n of 28" updates would
   * interrupt each other the whole way down and say nothing the listener can
   * act on.
   */
  const spokenPhase = useRef<PreloadState['phase'] | null>(null);
  useEffect(() => {
    if (spokenPhase.current === state.phase) return;
    spokenPhase.current = state.phase;
    announcer.speak(announcementFor(state), {
      // "Ready" and a failure both interrupt; only the in-progress line waits
      // its turn. This is not politeness, it is a race: the screen's own
      // arrival announcement is assertive, and an assertive utterance clears
      // whatever is pending — so a polite "Ready." raised in the same breath
      // would be discarded, and the one word the player is waiting for would
      // never arrive. On a warm cache that window is a handful of
      // milliseconds, which is exactly when it happens.
      ...(state.phase === 'sounds' ? TIER.notify : TIER.interrupt),
      dedupeKey: `preload:${state.phase}`,
    });
  }, [state]);

  const retry = useCallback(() => {
    // Only what actually failed. Refetching the whole set would be paying
    // again for clips already sitting in memory.
    const again = [...state.blocking, ...state.tolerable] as SoundKey[];
    if (again.length === 0) return;

    setState(previous => ({
      ...previous,
      phase: 'sounds',
      done: 0,
      total: splitByUrgency(again).first.length || again.length,
      blocking: [],
      tolerable: [],
    }));
    run(again);
  }, [state.blocking, state.tolerable, run]);

  return { state, retry };
}
