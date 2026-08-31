import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerToClientEvents } from '@/features/game/types/events';

/**
 * The social provider's state rules.
 *
 * The game socket is the seam, so it is what gets faked: `on` records
 * subscriptions that the test can fire, and `request` answers acks.
 */
const handlers = new Map<string, (payload: unknown) => void>();
const unsubscribed: string[] = [];

const gameSocket = {
  connection: 'connected' as const,
  on(event: string, handler: (payload: unknown) => void) {
    handlers.set(event, handler);
    return () => {
      unsubscribed.push(event);
      handlers.delete(event);
    };
  },
  // Every ack-style call resolves to an empty snapshot; these tests are about
  // what the *pushed* events do.
  request: vi.fn(async () => ({ me: null, friends: [], requests: [] })),
};

vi.mock('@/features/game/context', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/features/game/context',
  );
  return { ...actual, useGameSocket: () => gameSocket };
});

const { SocialProvider } = await import('./SocialProvider');
const { useSocial } = await import('./useSocial');

function fire<E extends keyof ServerToClientEvents>(event: E, payload?: unknown) {
  act(() => handlers.get(event as string)?.(payload));
}

function Probe() {
  const { error, incomingInvite, party, friends, requests, sendInvite } = useSocial();
  return (
    <div>
      <span data-testid="error">{error ?? 'none'}</span>
      <span data-testid="incoming">{incomingInvite?.id ?? 'none'}</span>
      <span data-testid="party">{party?.id ?? 'none'}</span>
      <span data-testid="friends">{friends.map(f => f.handle).join(',') || 'none'}</span>
      <span data-testid="requests">{requests.map(r => r.id).join(',') || 'none'}</span>
      {/* Sending is the only way to become the sender of record. */}
      <button onClick={() => void sendInvite('u-cal', 2)}>send</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <SocialProvider>
      <Probe />
    </SocialProvider>,
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

const invite = {
  id: 'inv-1',
  from: { id: 'u-ann', handle: 'ann', name: 'Ann Lee' },
  targetPlayers: 2,
  expiresAt: Date.now() + 60_000,
};

/** What `invite_send` acks with — the game now being assembled. */
const party = {
  id: 'p-1',
  host: { id: 'u-me', handle: 'me', name: 'Me' },
  targetPlayers: 2,
  players: [{ id: 'u-me', handle: 'me', name: 'Me' }],
  invited: [{ user: { id: 'u-cal', handle: 'cal', name: 'Cally' }, status: 'invited' }],
  canStart: false,
};

beforeEach(() => {
  handlers.clear();
  unsubscribed.length = 0;
  gameSocket.request.mockClear();
});

afterEach(cleanup);

describe('SocialProvider', () => {
  it('holds an incoming invitation', () => {
    renderProvider();
    fire('invite_received', invite);
    expect(text('incoming')).toBe('inv-1');
  });

  it('does not tell the invitee what they already chose', () => {
    renderProvider();
    fire('invite_received', invite);
    fire('invite_ended', {
      id: 'inv-1',
      reason: 'declined',
      message: 'The invitation was declined.',
    });

    // They pressed Decline; repeating it back is noise.
    expect(text('incoming')).toBe('none');
    expect(text('error')).toBe('none');
  });

  it('tells the host when an invitation they sent expires', async () => {
    renderProvider();
    gameSocket.request.mockResolvedValueOnce(party as never);

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click();
    });
    expect(text('party')).toBe('p-1');

    fire('invite_ended', {
      id: 'inv-2',
      reason: 'expired',
      message: 'That invitation expired.',
    });

    // The host chose nothing and is waiting; without this they are left
    // listening to silence wondering whether anyone answered.
    expect(text('error')).toBe('That invitation expired.');
  });

  it('stays quiet with the host when an invitation is accepted', async () => {
    renderProvider();
    gameSocket.request.mockResolvedValueOnce(party as never);

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click();
    });

    fire('invite_ended', {
      id: 'inv-3',
      reason: 'accepted',
      message: 'The invitation was accepted.',
    });

    // The game filling up says this far better than a banner would.
    expect(text('error')).toBe('none');
  });

  it('holds the game being assembled, and drops it when it ends', () => {
    renderProvider();
    fire('party_updated', party);
    expect(text('party')).toBe('p-1');

    fire('party_ended', {
      id: 'p-1',
      reason: 'cancelled',
      message: 'The host cancelled the game.',
    });
    expect(text('party')).toBe('none');
  });

  it('removes a friend and any request when the other side drops you', () => {
    renderProvider();
    fire('friend_request_received', {
      id: 'pair-1',
      user: { id: 'u-cal', handle: 'cal', name: 'Cally' },
      direction: 'incoming',
      createdAt: 1,
    });
    expect(text('requests')).toBe('pair-1');

    fire('friend_removed', { userId: 'u-cal' });
    expect(text('requests')).toBe('none');
  });

  it('adds a friend when a request this player sent is accepted', () => {
    renderProvider();
    fire('friend_request_resolved', {
      id: 'pair-1',
      accepted: true,
      user: { id: 'u-cal', handle: 'cal', name: 'Cally' },
    });
    expect(text('friends')).toBe('cal');
  });

  it('adds nobody when a request is declined', () => {
    renderProvider();
    fire('friend_request_resolved', {
      id: 'pair-1',
      accepted: false,
      user: { id: 'u-cal', handle: 'cal', name: 'Cally' },
    });
    expect(text('friends')).toBe('none');
  });

  it('applies a presence change to the right friend', () => {
    renderProvider();
    fire('friend_request_resolved', {
      id: 'pair-1',
      accepted: true,
      user: { id: 'u-cal', handle: 'cal', name: 'Cally' },
    });
    fire('friend_presence', { userId: 'u-cal', presence: 'in_game' });
    // Presence lives on the friend row; the probe only proves it did not throw
    // away the friend while updating them.
    expect(text('friends')).toBe('cal');
  });

  it('unsubscribes every listener on unmount', () => {
    const view = renderProvider();
    const subscribed = [...handlers.keys()];
    expect(subscribed.length).toBeGreaterThan(0);

    view.unmount();
    // Listeners that outlive the provider are how duplicate events start.
    expect(unsubscribed.sort()).toEqual(subscribed.sort());
  });
});
