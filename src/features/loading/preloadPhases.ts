import { plural } from '@/lib/a11y/phrases';

/**
 * What the loading screen is doing, and what it says about it.
 *
 * Pure and separate from the component for the usual reason — the wording is
 * what a blind player actually receives, so it is worth testing directly
 * rather than through a render.
 *
 * There is no "starting" phase either: the hook begins fetching the moment it
 * exists, so a phase before that would last zero frames.
 *
 * **There is no "loading assets" phase, because there are no assets.** The app
 * ships no gameplay images, the brand mark is inline SVG and the type is a
 * system font stack, so the only thing that crosses the network is the 28
 * audio clips. A phase that announced work nobody is doing would be a lie told
 * to the people least able to check it.
 */
export type PreloadPhase = 'sounds' | 'ready' | 'failed';

export interface PreloadState {
  phase: PreloadPhase;
  /** Clips settled so far, ready or not. */
  done: number;
  total: number;
  /** Critical clips that did not load. Non-empty only when `phase` is 'failed'. */
  blocking: string[];
  /** Clips that failed but are not worth blocking for. */
  tolerable: string[];
}

/**
 * The line a screen reader hears when the phase changes.
 *
 * Phase only, never the running count: announcing "3 of 28", "4 of 28" would
 * interrupt itself twenty-eight times and tell the listener nothing they can
 * act on. The count is on screen for whoever is watching it, and the progress
 * bar carries it for anyone who goes looking.
 */
export function announcementFor(state: PreloadState): string {
  switch (state.phase) {
    case 'sounds':
      return 'Loading sounds.';
    case 'ready':
      return state.tolerable.length > 0
        ? `Ready. ${plural(
            state.tolerable.length,
            'sound',
          )} could not be loaded and will be silent.`
        : 'Ready.';
    case 'failed':
      return `${plural(
        state.blocking.length,
        'game sound',
      )} could not be loaded. The game needs them to play properly. Choose Retry to try again.`;
  }
}

/** The line on screen, which may carry the count the announcement leaves out. */
export function captionFor(state: PreloadState): string {
  switch (state.phase) {
    case 'sounds':
      return state.done === 0
        ? 'Loading sounds…'
        : `Loading sounds… ${state.done} of ${state.total}`;
    case 'ready':
      return 'Ready to play';
    case 'failed':
      return `${plural(state.blocking.length, 'sound')} failed to load`;
  }
}
