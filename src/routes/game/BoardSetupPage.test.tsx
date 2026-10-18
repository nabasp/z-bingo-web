import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announcer } from '@/lib/a11y';

/**
 * The setup screen's keyboard contract.
 *
 * Laying out a board you cannot see is the hardest part of the game to do
 * blind: you are building an arrangement from memory that you will then have
 * to navigate. Every key on this screen exists to make that checkable before
 * it is locked in — and the failure mode to guard against is not a key that
 * errors, but one the grid swallows and answers with silence.
 */

const toggleMic = vi.fn();
const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/features/game/context', () => ({
  useGameSocket: () => ({
    room: { size: 3, word: 'BUS', players: [] },
    error: null,
    connection: 'connected',
    leaveRoom: vi.fn(),
    submitBoard: vi.fn(),
    me: { ready: false },
  }),
}));

vi.mock('@/features/game/mode', () => ({ useGameMode: () => 'multiplayer' }));

vi.mock('@/features/voice', () => ({ useMicToggleAction: () => toggleMic }));

vi.mock('@/lib/a11y/useAnnounceOnFocus', () => ({
  useAnnounceOnFocus: () => ({ current: null }),
}));

const { BoardSetupPage } = await import('./BoardSetupPage');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toggleMic.mockClear();
});

/** The cell at a flat index, addressed the way assistive tech would. */
function cell(index: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-index="${index}"]`);
  if (!found) throw new Error(`no cell at index ${index}`);
  return found;
}

function press(key: string) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

describe('BoardSetupPage keyboard', () => {
  it('toggles the mic on the bare M', () => {
    // This key used to be matched, swallowed and silent here: the page never
    // passed a mic handler, while the spoken help cheerfully announced it.
    render(<BoardSetupPage />);
    cell(0).focus();

    press('M');
    expect(toggleMic).toHaveBeenCalledTimes(1);
  });

  it('fills the rest of the board on F and takes it back on U', () => {
    render(<BoardSetupPage />);
    cell(0).focus();

    press('F');
    expect(cell(8)).toHaveAccessibleName(/filled/);

    press('U');
    expect(cell(8)).toHaveAccessibleName(/blank/);
  });

  it('answers the line readouts about blank cells, not unmarked ones', () => {
    const speak = vi.spyOn(announcer, 'speak');
    render(<BoardSetupPage />);
    cell(0).focus();

    // Walked with the arrows rather than focused outright: a raw DOM focus
    // call does not flush React's roving state in jsdom, so the grid would
    // still answer about the row the cursor started on.
    press('ArrowDown');
    press('ArrowRight');
    expect(cell(4)).toHaveFocus();

    // Clicked rather than Entered: the cell is a native button, so in a
    // browser Enter reaches it as a click, but jsdom does not synthesise one.
    // One cell of row 2 placed, so the row needs the other two.
    fireEvent.click(cell(4));
    speak.mockClear();
    press('R');

    expect(speak.mock.calls.map(call => String(call[0]))).toContain(
      'Row 2 needs 2 cells: A2, C2.',
    );
  });

  it('answers the anti-diagonal on A', () => {
    const speak = vi.spyOn(announcer, 'speak');
    render(<BoardSetupPage />);
    cell(0).focus();

    press('A');
    expect(speak.mock.calls.map(call => String(call[0])).join(' ')).toContain(
      'Anti-diagonal',
    );
  });

  it('says nothing about scores, which are all zero here', () => {
    const speak = vi.spyOn(announcer, 'speak');
    render(<BoardSetupPage />);
    cell(0).focus();

    press('S');
    expect(speak).not.toHaveBeenCalled();
  });

  it('offers Undo as a button too, so it is not keyboard-only', () => {
    render(<BoardSetupPage />);

    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Random Fill' }));
    expect(undo).toBeEnabled();
  });
});
