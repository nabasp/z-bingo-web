import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announcer } from '@/lib/a11y';
import type { Cell } from '../types';
import { useBoardSetup } from './useBoardSetup';

/**
 * Undo, and the confirmations that go with it.
 *
 * The board is laid out by pressing cells in an order you choose, which for a
 * sighted player is self-correcting — you can see what moved. Undo exists for
 * the two presses that move cells you never chose, Shuffle and Random Fill,
 * and for the player who has no way to check what just happened except by
 * being told.
 */

const submitBoard = vi.fn();

vi.mock('../context', () => ({
  useGameSocket: () => ({ submitBoard, me: { ready: false } }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  submitBoard.mockClear();
});

function setup(size: 3 | 4 = 3) {
  return renderHook(() => useBoardSetup(size));
}

/** The numbers on the board, in reading order. */
function values(cells: Cell[]): Array<number | null> {
  return cells.map(cell => cell.value);
}

describe('useBoardSetup undo', () => {
  it('has nothing to undo on a fresh board', () => {
    const { result } = setup();
    expect(result.current.canUndo).toBe(false);
  });

  it('takes back a single placement', () => {
    const { result } = setup();

    act(() => result.current.onCellPress(result.current.cells[4]));
    expect(values(result.current.cells)[4]).toBe(1);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(values(result.current.cells)[4]).toBeNull();
    expect(result.current.canUndo).toBe(false);
  });

  it('takes back a random fill, which is the press it exists for', () => {
    const { result } = setup();

    act(() => result.current.onCellPress(result.current.cells[0]));
    const afterOne = values(result.current.cells);

    act(() => result.current.fillRandom());
    expect(result.current.isComplete).toBe(true);

    act(() => result.current.undo());
    expect(values(result.current.cells)).toEqual(afterOne);
  });

  it('unwinds several steps in order', () => {
    const { result } = setup();

    act(() => result.current.onCellPress(result.current.cells[0]));
    act(() => result.current.onCellPress(result.current.cells[1]));
    act(() => result.current.onCellPress(result.current.cells[2]));

    act(() => result.current.undo());
    expect(values(result.current.cells).slice(0, 3)).toEqual([1, 2, null]);

    act(() => result.current.undo());
    expect(values(result.current.cells).slice(0, 3)).toEqual([1, null, null]);
  });

  it('says so rather than going quiet when there is nothing left', () => {
    // Silence here is indistinguishable from a dropped keypress, and the usual
    // response to that is to press harder.
    const speak = vi.spyOn(announcer, 'speak');
    const { result } = setup();

    act(() => result.current.undo());

    expect(speak.mock.calls.map(call => String(call[0]))).toContain(
      'Nothing to undo.',
    );
  });
});

describe('useBoardSetup announcements', () => {
  it('confirms a placement with the same words the cursor uses', () => {
    const speak = vi.spyOn(announcer, 'speak');
    const { result } = setup();

    act(() => result.current.onCellPress(result.current.cells[4]));

    expect(speak).toHaveBeenCalledWith(
      expect.stringContaining('1. filled'),
      expect.anything(),
    );
  });

  it('confirms a cleared cell as blank', () => {
    const speak = vi.spyOn(announcer, 'speak');
    const { result } = setup();

    act(() => result.current.onCellPress(result.current.cells[4]));
    speak.mockClear();
    act(() => result.current.onCellPress(result.current.cells[4]));

    expect(speak).toHaveBeenCalledWith(
      expect.stringContaining('blank'),
      expect.anything(),
    );
  });

  it('says what a random fill did, which nothing else would', () => {
    const speak = vi.spyOn(announcer, 'speak');
    const { result } = setup();

    act(() => result.current.fillRandom());

    expect(speak.mock.calls.map(call => String(call[0]))).toContain(
      'Cells are filled with random numbers.',
    );
  });

  it('names the cell it put back when exactly one moved', () => {
    const speak = vi.spyOn(announcer, 'speak');
    const { result } = setup();

    act(() => result.current.onCellPress(result.current.cells[4]));
    speak.mockClear();
    act(() => result.current.undo());

    const said = speak.mock.calls.map(call => String(call[0])).join(' ');
    expect(said).toContain('Undo');
    expect(said).toContain('blank');
  });

  it('does not name a cell after a fill, where naming one would mislead', () => {
    const speak = vi.spyOn(announcer, 'speak');
    const { result } = setup();

    act(() => result.current.fillRandom());
    speak.mockClear();
    act(() => result.current.undo());

    expect(speak.mock.calls.map(call => String(call[0]))).toContain('Undo');
  });
});
