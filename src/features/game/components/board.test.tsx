import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cell } from '../types';
import { BingoHeaderRow, BoardGrid } from './board';

/**
 * The board's keyboard contract.
 *
 * `BoardGrid` is an ARIA grid with a roving tabindex: the whole board is one
 * tab stop, and the arrow keys move between cells once you are inside it. That
 * behaviour is what makes the game playable without a mouse, and until now
 * nothing pinned it — these tests exist so the shortcut work layered on top
 * cannot quietly break the thing it is built on.
 *
 * The invariant worth stating: **exactly one cell is tabbable at any moment**.
 * Lose it and an 8×8 board becomes 64 tab stops.
 */

function board(size: number): Cell[] {
  return Array.from({ length: size * size }, (_, index) => ({
    index,
    value: index + 1,
    marked: false,
  }));
}

function renderBoard(size = 3) {
  return render(
    <BoardGrid cells={board(size)} size={size} label="Your board" onCellPress={vi.fn()} />,
  );
}

/** The cell at a flat index, found the way assistive tech would address it. */
function cell(index: number): HTMLElement {
  const found = document
    .querySelector('[role="grid"]')
    ?.querySelector<HTMLElement>(`[data-index="${index}"]`);
  if (!found) throw new Error(`no cell at index ${index}`);
  return found;
}

function tabbableCells(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="gridcell"][tabindex="0"]'),
  );
}

/** Press a key on the grid and report whether the default was prevented. */
function press(key: string, init: Partial<KeyboardEventInit> = {}): boolean {
  const grid = screen.getByRole('grid');
  const event = createEvent.keyDown(grid, { key, bubbles: true, ...init });
  fireEvent(grid, event);
  return event.defaultPrevented;
}

afterEach(cleanup);

describe('BoardGrid structure', () => {
  it('exposes itself as a grid of rows and cells', () => {
    renderBoard(3);
    const grid = screen.getByRole('grid');

    expect(grid).toHaveAccessibleName('Your board');
    expect(grid).toHaveAttribute('aria-rowcount', '3');
    expect(grid).toHaveAttribute('aria-colcount', '3');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByRole('gridcell')).toHaveLength(9);
  });

  it('is a single tab stop', () => {
    // The whole point of a roving tabindex. Without it a big board buries
    // every other control on the page behind dozens of tab presses.
    renderBoard(5);
    expect(tabbableCells()).toHaveLength(1);
  });
});

describe('BoardGrid arrow-key navigation', () => {
  it('moves right and left along a row', () => {
    renderBoard(3);
    cell(0).focus();

    press('ArrowRight');
    expect(cell(1)).toHaveFocus();

    press('ArrowLeft');
    expect(cell(0)).toHaveFocus();
  });

  it('moves down and up a column', () => {
    renderBoard(3);
    cell(0).focus();

    press('ArrowDown');
    expect(cell(3)).toHaveFocus();

    press('ArrowUp');
    expect(cell(0)).toHaveFocus();
  });

  it('keeps exactly one tabbable cell as focus moves', () => {
    renderBoard(3);
    cell(0).focus();
    press('ArrowRight');
    press('ArrowDown');

    const tabbable = tabbableCells();
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(cell(4));
  });

  it('stops at the edges rather than wrapping', () => {
    renderBoard(3);
    cell(0).focus();

    press('ArrowLeft');
    expect(cell(0)).toHaveFocus();

    press('ArrowUp');
    expect(cell(0)).toHaveFocus();
  });

  it('swallows the arrow key even where it cannot move', () => {
    // At an edge there is nowhere to go, but the page must not scroll out from
    // under the player — so the key is consumed regardless.
    renderBoard(3);
    cell(0).focus();

    expect(press('ArrowLeft')).toBe(true);
    expect(press('ArrowUp')).toBe(true);
  });

  it('leaves keys it does not own alone', () => {
    // Tab, Enter and everything else must reach the browser untouched —
    // breaking that is how a grid becomes a focus trap.
    renderBoard(3);
    cell(0).focus();

    expect(press('Tab')).toBe(false);
    expect(press('a')).toBe(false);
  });
});

describe('BoardGrid Home and End', () => {
  /**
   * Walk to the middle of a 3×3 using the grid's own keys.
   *
   * Deliberately not `cell(4).focus()`: a raw DOM focus call does not flush
   * React's roving state in jsdom, so the grid would still think the cursor was
   * on cell 0 and Home would jump from the wrong row. Navigating the way a
   * player does keeps the test honest about what it is exercising.
   */
  function walkToCentre() {
    renderBoard(3);
    cell(0).focus();
    press('ArrowDown');
    press('ArrowRight');
    expect(cell(4)).toHaveFocus();
  }

  it('jumps to the ends of the current row', () => {
    walkToCentre();

    press('Home');
    expect(cell(3)).toHaveFocus();

    press('End');
    expect(cell(5)).toHaveFocus();
  });

  it('jumps to the corners of the board with Ctrl', () => {
    walkToCentre();

    press('Home', { ctrlKey: true });
    expect(cell(0)).toHaveFocus();

    press('End', { ctrlKey: true });
    expect(cell(8)).toHaveFocus();
  });
});

describe('BoardGrid activation', () => {
  it('calls back with the pressed cell', () => {
    // Enter and Space come free from the native <button>; what matters is that
    // the click path reports the right cell.
    const onCellPress = vi.fn();
    render(
      <BoardGrid cells={board(3)} size={3} label="Your board" onCellPress={onCellPress} />,
    );

    fireEvent.click(cell(4));
    expect(onCellPress).toHaveBeenCalledWith(
      expect.objectContaining({ index: 4, value: 5 }),
    );
  });

  it('never disables a cell', () => {
    // A disabled button is skipped by keyboard navigation and refused by
    // assistive tech, which would silence the spoken "not your turn"
    // rejection. This is the obvious "fix" to reach for, so it is guarded.
    render(
      <BoardGrid
        cells={board(3)}
        size={3}
        label="Your board"
        canActivate={false}
        onCellPress={vi.fn()}
      />,
    );

    for (const gridcell of screen.getAllByRole('gridcell')) {
      expect(gridcell).not.toBeDisabled();
      expect(gridcell).not.toHaveAttribute('aria-disabled', 'true');
    }
  });
});

describe('BingoHeaderRow', () => {
  it('shows the word for a board of any size', () => {
    // It used to hardcode BINGO and render nothing at all for 3×3 or 4×4,
    // which silently removed the feature from every non-5×5 board.
    render(<BingoHeaderRow word="BUS" />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('strikes a letter for each completed line', () => {
    const { container } = render(<BingoHeaderRow word="BINGO" earned={2} />);
    const struck = container.querySelectorAll('.line-through');

    expect(struck).toHaveLength(2);
    expect(struck[0]).toHaveTextContent('B');
    expect(struck[1]).toHaveTextContent('I');
  });

  it('says the progress out loud', () => {
    render(<BingoHeaderRow word="GAME" earned={3} />);
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'GAME. 3 of 4 letters complete.',
    );
  });

  it('never claims more letters than the word has', () => {
    // A 5×5 has twelve possible lines but only five letters, so the raw count
    // can overshoot — "12 of 5 letters complete" would be nonsense.
    render(<BingoHeaderRow word="BINGO" earned={12} />);
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'BINGO. 5 of 5 letters complete.',
    );
  });

  it('renders nothing without a word', () => {
    // The word arrives from the server, so there is a beat before it exists.
    const { container } = render(<BingoHeaderRow word="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
