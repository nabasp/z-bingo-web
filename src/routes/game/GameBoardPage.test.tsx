import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cell } from '@/features/game/types';

/**
 * The board page's keyboard behaviour.
 *
 * The case that matters is Escape. It is bound at the document, and a modal
 * `<dialog>` does *not* swallow the key — the browser's close-request is a
 * default action that runs after the event has finished bubbling. So without a
 * guard, one press would close the confirmation and reopen it in the same
 * breath, leaving a dialog no keyboard user could dismiss.
 *
 * Note what jsdom does not give us: its `showModal` shim only sets `open`, so
 * there is no focus trap and Escape does not close anything by itself. These
 * tests therefore prove *our* guard, and the browser's half of the bargain is
 * covered by dispatching `cancel` explicitly.
 */

const leaveRoom = vi.fn();
const callNumber = vi.fn();
const navigate = vi.fn();

function cells(size: number): Cell[] {
  return Array.from({ length: size * size }, (_, index) => ({
    index,
    value: index + 1,
    marked: false,
  }));
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/features/game/context', () => ({
  useGameSocket: () => ({ error: null, connection: 'connected' }),
}));

vi.mock('@/features/game/hooks', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useGameFlowNavigation: () => {},
    useGame: () => ({
      board: cells(3),
      completedLines: [],
      progress: [],
      announcement: null,
      currentPlayer: { id: 'p1', name: 'Ann' },
      isMyTurn: true,
      boardSize: 3,
      word: 'BUS',
      recentCalls: [],
      turnNumber: 1,
      turnEndsAt: undefined,
      turnSeconds: 60,
      callNumber,
      leaveRoom,
    }),
  };
});

vi.mock('@/features/voice', () => ({
  VoiceBanner: () => null,
  VoiceButton: () => <button type="button">Mic On</button>,
}));

const { GameBoardPage } = await import('./GameBoardPage');

/** The exit confirmation, or null when it is closed. */
function openDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('dialog[open]');
}

function escape(): void {
  fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Escape on the board page', () => {
  it('asks before leaving rather than leaving', () => {
    // Going mid-game forfeits the match, so the key opens a confirmation and
    // nothing else.
    render(<GameBoardPage />);
    expect(openDialog()).toBeNull();

    escape();

    expect(openDialog()).not.toBeNull();
    expect(screen.getByRole('button', { name: /leave game/i })).toBeInTheDocument();
    expect(leaveRoom).not.toHaveBeenCalled();
  });

  it('does not reopen the dialog it just closed', () => {
    // The guard under test: a second Escape must reach the dialog, not us.
    render(<GameBoardPage />);
    escape();
    const dialog = openDialog();
    expect(dialog).not.toBeNull();

    escape();

    expect(openDialog()).toBe(dialog);
    expect(leaveRoom).not.toHaveBeenCalled();
  });

  it('leaves the game only when the player says so', () => {
    render(<GameBoardPage />);
    escape();

    fireEvent.click(screen.getByRole('button', { name: /leave game/i }));
    expect(leaveRoom).toHaveBeenCalledTimes(1);
  });

  it('treats a dismissed dialog as a decision not to leave', () => {
    // What the browser does on Escape inside an open dialog, which the jsdom
    // shim does not simulate.
    render(<GameBoardPage />);
    escape();
    const dialog = openDialog();

    fireEvent(dialog!, new Event('cancel'));

    expect(openDialog()).toBeNull();
    expect(leaveRoom).not.toHaveBeenCalled();
  });
});

describe('Alt+B on the board page', () => {
  it('moves focus into the board', () => {
    render(<GameBoardPage />);

    fireEvent.keyDown(document, { key: 'b', code: 'KeyB', altKey: true, bubbles: true });

    expect(document.activeElement).toHaveAttribute('role', 'gridcell');
  });
});

describe('the board page tells you the keys exist', () => {
  it('states the shortcuts on the page', () => {
    // Chords are invisible. Browse-mode readers meet this text right where the
    // board starts.
    render(<GameBoardPage />);

    expect(screen.getByText(/Alt plus B/)).toBeInTheDocument();
    expect(screen.getByText(/arrow keys/)).toBeInTheDocument();
  });
});
