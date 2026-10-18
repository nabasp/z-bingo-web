import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnounceOnFocus } from './useAnnounceOnFocus';

/**
 * Parking focus is the whole job of this hook.
 *
 * A client-side route change moves no focus and reads no title by default, so
 * without this a keyboard user arrives on a new page with focus on nothing and
 * Tab starts again from the skip link. These pin the part that broke: the
 * focus timer used to be cancelled by any re-render inside its delay, and the
 * re-run then decided it was "not the first" and never scheduled another.
 */
function Page({ detail }: { detail: string }) {
  const ref = useAnnounceOnFocus<HTMLHeadingElement>({ title: 'Game board', detail });
  return (
    <h1 ref={ref} tabIndex={-1}>
      Game board
    </h1>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useAnnounceOnFocus', () => {
  it('parks focus on the heading after the settle delay', () => {
    const { getByRole } = render(<Page detail="First" />);
    expect(document.activeElement).toBe(document.body);

    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(getByRole('heading'));
  });

  /**
   * The regression. React's StrictMode re-runs every effect on mount — run,
   * clean up, run again — and any re-render that changes `detail` does the
   * same. Either one cancelled the pending timer, and the hook then skipped
   * rescheduling it, so focus was silently never moved at all.
   */
  it('still parks focus when the effect re-runs before the delay elapses', () => {
    const { rerender, getByRole } = render(<Page detail="First" />);
    vi.advanceTimersByTime(50);
    rerender(<Page detail="Second, arriving late from the server" />);

    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(getByRole('heading'));
  });

  it('does not drag focus back once the player has moved on', () => {
    // Re-running on a late content change must not pull a player off whatever
    // they were exploring — that is why focus is parked once per arrival.
    const { rerender, getByRole } = render(<Page detail="First" />);
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(getByRole('heading'));

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    rerender(<Page detail="A later update" />);
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(elsewhere);
  });
});
