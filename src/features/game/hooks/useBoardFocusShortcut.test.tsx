import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardGrid } from '../components/board';
import type { Cell } from '../types';
import { useBoardFocusShortcut } from './useBoardFocusShortcut';

/**
 * Alt+B, against a real board.
 *
 * Deliberately not a stubbed grid: the hook finds its target through
 * `[role="gridcell"][tabindex="0"]`, which is a contract with `BoardGrid`'s
 * roving tabindex. A stub would let that contract rot while the tests stayed
 * green — the interesting case, returning to the *same* cell the player left,
 * only works if the real roving state is doing its job.
 */

const speak = vi.fn();
vi.mock('@/lib/a11y', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/a11y')>();
  return { ...actual, announcer: { speak: (...args: unknown[]) => speak(...args) } };
});

const GRID_ID = 'test-board';

function cells(size: number): Cell[] {
  return Array.from({ length: size * size }, (_, index) => ({
    index,
    value: index + 1,
    marked: false,
  }));
}

function Page({ withBoard = true, withOutside = true }: { withBoard?: boolean; withOutside?: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useBoardFocusShortcut({ gridId: GRID_ID, fallbackRef: headingRef });

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        Game board
      </h1>
      {withOutside ? <button type="button">Exit</button> : null}
      {withBoard ? (
        <BoardGrid
          id={GRID_ID}
          cells={cells(3)}
          size={3}
          label="Your board"
          onCellPress={vi.fn()}
        />
      ) : null}
    </>
  );
}

function altB(): void {
  fireEvent.keyDown(document, { key: 'b', code: 'KeyB', altKey: true, bubbles: true });
}

function cell(index: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-index="${index}"]`);
  if (!found) throw new Error(`no cell at index ${index}`);
  return found;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Alt+B into the board', () => {
  it('moves focus to a cell', () => {
    render(<Page />);
    screen.getByRole('button', { name: 'Exit' }).focus();

    altB();
    expect(cell(0)).toHaveFocus();
  });

  it('lands on the tabbable cell, not simply the first', () => {
    render(<Page />);
    const grid = screen.getByRole('grid');

    // Walk the cursor, then leave the board entirely.
    cell(0).focus();
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(cell(4)).toHaveFocus();

    screen.getByRole('button', { name: 'Exit' }).focus();
    altB();

    // Back where the player was, not back to the beginning.
    expect(cell(4)).toHaveFocus();
  });
});

describe('Alt+B out of the board', () => {
  it('returns focus to where the player came from', () => {
    render(<Page />);
    const exit = screen.getByRole('button', { name: 'Exit' });
    exit.focus();

    altB();
    expect(cell(0)).toHaveFocus();

    altB();
    expect(exit).toHaveFocus();
  });

  it('falls back to the heading when that element is gone', () => {
    // The page re-renders constantly during play; whatever the player was on
    // may not survive until they press Alt+B again.
    function Disappearing() {
      const [show, setShow] = useState(true);
      const headingRef = useRef<HTMLHeadingElement>(null);
      useBoardFocusShortcut({ gridId: GRID_ID, fallbackRef: headingRef });
      return (
        <>
          <h1 ref={headingRef} tabIndex={-1}>
            Game board
          </h1>
          {show ? (
            <button type="button" onClick={() => setShow(false)}>
              Temporary
            </button>
          ) : null}
          <BoardGrid
            id={GRID_ID}
            cells={cells(3)}
            size={3}
            label="Your board"
            onCellPress={vi.fn()}
          />
        </>
      );
    }

    render(<Disappearing />);
    const temporary = screen.getByRole('button', { name: 'Temporary' });
    temporary.focus();
    altB();
    expect(cell(0)).toHaveFocus();

    // Remove it while focus is parked on the board.
    fireEvent.click(temporary);
    altB();

    expect(screen.getByRole('heading', { name: 'Game board' })).toHaveFocus();
  });

  it('falls back to the heading when nothing was focused', () => {
    render(<Page withOutside={false} />);

    altB();
    expect(cell(0)).toHaveFocus();

    altB();
    expect(screen.getByRole('heading', { name: 'Game board' })).toHaveFocus();
  });
});

describe('Alt+B without a board', () => {
  it('says so rather than doing nothing', () => {
    // Between rounds the board unmounts. A silent key reads as a broken one.
    render(<Page withBoard={false} />);

    altB();
    expect(speak).toHaveBeenCalledWith(
      expect.stringMatching(/not ready/i),
      expect.objectContaining({ assertive: true }),
    );
  });
});
