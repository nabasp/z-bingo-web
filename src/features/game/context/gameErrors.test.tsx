import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomSnapshot } from '../types/events';

/**
 * How in-game rejections behave.
 *
 * Tapping a cell while waiting for your turn is an ordinary thing to do — the
 * board never disables its cells, so assistive tech can reach them. These pin
 * the three rules that follow from that: stay quiet the first couple of times,
 * never stay on screen, and go the moment the game moves on.
 */

const handlers = new Map<string, (payload: unknown) => void>();
const spoken: string[] = [];

const fakeSocket = {
  connected: true,
  on(event: string, handler: (payload: unknown) => void) {
    handlers.set(event, handler);
  },
  emit(_event: string, ...args: unknown[]) {
    const ack = args.at(-1);
    if (typeof ack === 'function') (ack as (r: unknown) => void)({ ok: true, data: null });
  },
  connect: vi.fn(),
  close: vi.fn(),
  removeAllListeners: vi.fn(),
  off: vi.fn(),
};

vi.mock('@/lib/socketClient', () => ({ createGameSocket: () => fakeSocket }));
vi.mock('@/features/auth/context', () => ({
  useAuth: () => ({ status: 'authenticated', user: { id: 'ann' } }),
}));
vi.mock('@/lib/a11y/Announcer', () => ({
  announcer: {
    speak: (text: string) => spoken.push(text),
    clear: () => {},
  },
}));

const { GameSocketProvider } = await import('./GameSocketProvider');
const { useGameSocket } = await import('./useGameSocket');

function fire(event: string, payload?: unknown) {
  act(() => handlers.get(event)?.(payload));
}

function Probe() {
  const { error } = useGameSocket();
  return <span data-testid="error">{error?.message ?? 'none'}</span>;
}

const shown = () => screen.getByTestId('error').textContent;

const notYourTurn = { code: 'not_your_turn', message: "It's not your turn yet." };

const room = (overrides: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  code: 'brave-otter',
  size: 3,
  maxPlayers: 2,
  status: 'playing',
  hostId: 'ann',
  word: 'BIN',
  players: [],
  currentTurnSeat: 1,
  calledNumbers: [],
  callHistory: [],
  turnSeconds: 60,
  ...overrides,
});

beforeEach(() => {
  handlers.clear();
  spoken.length = 0;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(
    <GameSocketProvider>
      <Probe />
    </GameSocketProvider>,
  );
  fire('connect');
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('not-your-turn rejections', () => {
  it('stays quiet for the first two attempts', () => {
    fire('error', notYourTurn);
    expect(shown()).toBe('none');

    fire('error', notYourTurn);
    expect(shown()).toBe('none');
  });

  it('shows it on the third', () => {
    // By now the player is clearly trying to play and deserves to know why
    // nothing is happening.
    for (let i = 0; i < 3; i++) fire('error', notYourTurn);
    expect(shown()).toBe("It's not your turn yet.");
  });

  it('still tells assistive tech every single time', () => {
    // Suppressing the banner must not mean suppressing the feedback — the
    // board never disables its cells precisely so a rejection is audible.
    fire('error', notYourTurn);
    fire('error', notYourTurn);
    expect(spoken).toEqual(["It's not your turn yet.", "It's not your turn yet."]);
  });

  it('takes itself off the screen', () => {
    for (let i = 0; i < 3; i++) fire('error', notYourTurn);
    expect(shown()).toBe("It's not your turn yet.");

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // One mis-tap used to leave a red banner on the board for the whole game.
    expect(shown()).toBe('none');
  });

  it('clears the moment a number is called', () => {
    fire('game_state_updated', room());
    for (let i = 0; i < 3; i++) fire('error', notYourTurn);
    expect(shown()).toBe("It's not your turn yet.");

    fire('game_state_updated', room({ calledNumbers: [7] }));
    expect(shown()).toBe('none');
  });

  it('clears when the turn moves on', () => {
    fire('game_state_updated', room({ currentTurnSeat: 1 }));
    for (let i = 0; i < 3; i++) fire('error', notYourTurn);

    fire('game_state_updated', room({ currentTurnSeat: 0 }));
    expect(shown()).toBe('none');
  });

  it('starts counting again after the game moves on', () => {
    fire('game_state_updated', room());
    for (let i = 0; i < 3; i++) fire('error', notYourTurn);
    fire('game_state_updated', room({ calledNumbers: [7] }));

    // A fresh run of mis-taps gets the same grace as the first.
    fire('error', notYourTurn);
    expect(shown()).toBe('none');
    fire('error', notYourTurn);
    expect(shown()).toBe('none');
    fire('error', notYourTurn);
    expect(shown()).toBe("It's not your turn yet.");
  });
});

describe('other rejections', () => {
  const alreadyCalled = { code: 'already_called', message: '5 has already been called.' };

  it('shows immediately — the player needs to know their move did nothing', () => {
    fire('error', alreadyCalled);
    expect(shown()).toBe('5 has already been called.');
  });

  it('still clears itself', () => {
    fire('error', alreadyCalled);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(shown()).toBe('none');
  });

  it('resets the not-your-turn count, so the two do not interleave', () => {
    fire('error', notYourTurn);
    fire('error', notYourTurn);

    // A different rejection breaks the run: two near-misses plus one unrelated
    // complaint should not add up to "showing".
    fire('error', alreadyCalled);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(shown()).toBe('none');

    fire('error', notYourTurn);
    expect(shown()).toBe('none');
    fire('error', notYourTurn);
    expect(shown()).toBe('none');
    fire('error', notYourTurn);
    expect(shown()).toBe("It's not your turn yet.");
  });
});
