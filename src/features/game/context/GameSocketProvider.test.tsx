import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomSnapshot } from '../types/events';

/**
 * A stand-in for the Socket.IO client.
 *
 * The provider's whole job is translating socket events into state, so the
 * socket is the seam worth faking: `emit` records intents and `fire` plays the
 * server's side back, without a server or a network.
 */
const handlers = new Map<string, (payload: unknown) => void>();
const emitted: { event: string; payload: unknown }[] = [];

const fakeSocket = {
  connected: true,
  on(event: string, handler: (payload: unknown) => void) {
    handlers.set(event, handler);
  },
  emit(event: string, ...args: unknown[]) {
    emitted.push({ event, payload: args[0] });
    // The last argument is the ack callback for request-style events.
    const ack = args.at(-1);
    if (typeof ack === 'function') (ack as (r: unknown) => void)({ ok: true, data: null });
  },
  connect: vi.fn(),
  close: vi.fn(),
  removeAllListeners: vi.fn(),
};

vi.mock('@/lib/socketClient', () => ({
  createGameSocket: () => fakeSocket,
}));

vi.mock('@/features/auth/context', () => ({
  useAuth: () => ({ status: 'authenticated', user: { id: 'ann' } }),
}));

const { GameSocketProvider } = await import('./GameSocketProvider');
const { useGameSocket } = await import('./useGameSocket');

function fire(event: string, payload?: unknown): void {
  act(() => handlers.get(event)?.(payload));
}

const SNAPSHOT: RoomSnapshot = {
  code: 'brave-otter',
  size: 3,
  maxPlayers: 2,
  status: 'lobby',
  hostId: 'ann',
  word: 'BIN',
  players: [
    { id: 'ann', name: 'Ann', seat: 0, ready: false, connected: true, letters: 0 },
  ],
  currentTurnSeat: 0,
  calledNumbers: [],
  callHistory: [],
  turnSeconds: 60,
  yourBoard: [1, 2, 3],
};

/** Renders the pieces of context the assertions care about. */
function Probe() {
  const { room, notice, synced, connection } = useGameSocket();
  return (
    <div>
      <span data-testid="room">{room?.code ?? 'none'}</span>
      <span data-testid="notice">{notice?.message ?? 'none'}</span>
      <span data-testid="reason">{notice?.reason ?? 'none'}</span>
      <span data-testid="synced">{String(synced)}</span>
      <span data-testid="connection">{connection}</span>
    </div>
  );
}

function renderProvider() {
  return render(
    <GameSocketProvider>
      <Probe />
    </GameSocketProvider>,
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  handlers.clear();
  emitted.length = 0;
});

// Vitest does not auto-clean without the testing-library globals plugin, and a
// leftover tree would leave two of every probe element in the document.
afterEach(cleanup);

describe('GameSocketProvider', () => {
  it('asks the server where it is on connect, with no local room hint', () => {
    renderProvider();
    fire('connect');

    // Exactly `sync` — no `join_room` replayed from client-side storage. The
    // server resolves membership from the account, which is what makes mobile
    // reconnection work at all.
    expect(emitted.map(e => e.event)).toEqual(['sync']);
    expect(text('synced')).toBe('true');
  });

  it('holds the room state the server broadcasts', () => {
    renderProvider();
    fire('connect');
    fire('game_state_updated', SNAPSHOT);

    expect(text('room')).toBe('brave-otter');
  });

  it('clears the room and keeps the reason when the room closes', () => {
    renderProvider();
    fire('connect');
    fire('game_state_updated', SNAPSHOT);

    fire('room_closed', {
      code: 'brave-otter',
      reason: 'no_players_joined',
      message: 'Room closed because nobody else joined in time.',
    });

    // The room must go — the guard needs to send the player home — but the
    // explanation has to survive that navigation, or they arrive with no idea
    // what happened.
    expect(text('room')).toBe('none');
    expect(text('notice')).toBe('Room closed because nobody else joined in time.');
    expect(text('reason')).toBe('no_players_joined');
  });

  it('keeps a player’s own board when a boardless snapshot arrives', () => {
    renderProvider();
    fire('connect');
    fire('game_state_updated', SNAPSHOT);
    fire('room_updated', { ...SNAPSHOT, yourBoard: undefined });

    // Not directly observable through the probe, but the room must survive —
    // a wiped board would previously blank the player's grid mid-game.
    expect(text('room')).toBe('brave-otter');
  });

  it('reports the connection dropping', () => {
    renderProvider();
    fire('connect');
    expect(text('connection')).toBe('connected');

    fire('disconnect');
    expect(text('connection')).toBe('offline');
  });

  it('explains a session taken over by another device', () => {
    renderProvider();
    fire('connect');
    fire('game_state_updated', SNAPSHOT);
    fire('session_superseded');

    expect(text('room')).toBe('none');
    expect(text('notice')).toMatch(/another device/i);
  });
});
