import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SocialValue } from '@/features/social';

/**
 * The Play with Friends page.
 *
 * The behaviour worth pinning is the two phases: choosing a player count and
 * inviting, then watching the game fill. Both must explain themselves to
 * someone who cannot see the screen.
 */

let social: Partial<SocialValue>;
const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/features/game/context', () => ({
  useGameSocket: () => ({ room: null }),
}));

vi.mock('@/features/social', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/social');
  return { ...actual, useSocial: () => social };
});

const { PlayWithFriendsPage } = await import('./PlayWithFriendsPage');

const ann = { id: 'u-ann', handle: 'ann', name: 'Ann Lee', presence: 'online' as const };
const bob = { id: 'u-bob', handle: 'bob', name: 'Bobby', presence: 'in_game' as const };
const zoe = { id: 'u-zoe', handle: 'zoe', name: 'Zoe', presence: 'offline' as const };

function base(overrides: Partial<SocialValue> = {}): Partial<SocialValue> {
  return {
    loading: false,
    me: { id: 'u-me', handle: 'me', name: 'Me' },
    friends: [zoe, bob, ann],
    requests: [],
    incomingInvite: null,
    party: null,
    partyNotice: null,
    error: null,
    clearError: () => {},
    clearPartyNotice: () => {},
    sendInvite: vi.fn(async () => {}),
    startParty: vi.fn(async () => true),
    cancelParty: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PlayWithFriendsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

describe('PlayWithFriendsPage — choosing who to play with', () => {
  it('lists available friends before everyone else', () => {
    social = base();
    renderPage();

    const rows = screen.getAllByRole('listitem').map(row => row.getAttribute('aria-label'));
    // Ann is online, Bob is mid-game, Zoe is offline — the people who can
    // actually accept come first.
    expect(rows[0]).toContain('@ann');
    expect(rows[1]).toContain('@bob');
    expect(rows[2]).toContain('@zoe');
  });

  it('offers a player count including yourself', () => {
    social = base();
    renderPage();

    const group = screen.getByRole('radiogroup', { name: 'Players' });
    expect(group).toHaveAccessibleDescription('Including you.');
    expect(screen.getByRole('radio', { name: '2 Players' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3 Players' })).toBeInTheDocument();
  });

  it('invites a friend at the chosen player count', () => {
    social = base();
    renderPage();

    fireEvent.click(screen.getByRole('radio', { name: '3 Players' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invite Ann Lee' }));

    expect(social.sendInvite).toHaveBeenCalledWith('u-ann', 3);
  });

  it('says why a friend cannot be invited', () => {
    social = base();
    renderPage();

    const busy = screen.getByRole('button', { name: 'Invite Bobby' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('title', 'They are already in a game');

    const away = screen.getByRole('button', { name: 'Invite Zoe' });
    expect(away).toBeDisabled();
    expect(away).toHaveAttribute('title', 'They are offline');
  });

  it('filters by the search box', () => {
    social = base();
    renderPage();

    fireEvent.change(screen.getByLabelText('Search your friends'), {
      target: { value: 'ann' },
    });
    expect(screen.getByRole('button', { name: 'Invite Ann Lee' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite Zoe' })).toBeNull();
  });
});

describe('PlayWithFriendsPage — waiting in someone else\'s game', () => {
  const guestParty = {
    id: 'p-2',
    host: { id: 'u-ann', handle: 'ann', name: 'Ann Lee' },
    targetPlayers: 3,
    players: [
      { id: 'u-ann', handle: 'ann', name: 'Ann Lee' },
      { id: 'u-me', handle: 'me', name: 'Me' },
    ],
    invited: [],
    canStart: true,
  };

  it('says whose game it is and what it is waiting for', () => {
    social = base({ party: guestParty });
    renderPage();

    expect(
      screen.getByRole('heading', { name: "Ann Lee's game" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You're in. Waiting for 1 more player before the game starts."),
    ).toBeInTheDocument();
  });

  it('hides everything that belongs to the host', () => {
    social = base({ party: guestParty });
    renderPage();

    // A guest cannot invite, cannot change the count and cannot start — the
    // server refuses all three, so offering them would be a lie.
    expect(screen.queryByRole('radiogroup', { name: 'Players' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start now' })).toBeNull();
    expect(screen.queryByLabelText('Search your friends')).toBeNull();
  });

  it('offers a way out', () => {
    social = base({ party: guestParty });
    renderPage();

    // Landing somewhere with no exit is worse than not landing there at all.
    fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(social.cancelParty).toHaveBeenCalled();
  });
});

describe('PlayWithFriendsPage — waiting for the game to fill', () => {
  const party = {
    id: 'p-1',
    host: { id: 'u-me', handle: 'me', name: 'Me' },
    targetPlayers: 3,
    players: [
      { id: 'u-me', handle: 'me', name: 'Me' },
      { id: 'u-ann', handle: 'ann', name: 'Ann Lee' },
    ],
    invited: [{ user: { id: 'u-ann', handle: 'ann', name: 'Ann Lee' }, status: 'accepted' as const }],
    canStart: true,
  };

  it('shows how close the game is and who is in', () => {
    social = base({ party });
    renderPage();

    expect(screen.getByText('Game: 2 of 3 players')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem').map(r => r.getAttribute('aria-label'));
    expect(rows).toContain('@me, Me. You are hosting');
    expect(rows).toContain('@ann, Ann Lee. Accepted');
  });

  it('locks the player count and explains why', () => {
    social = base({ party });
    renderPage();

    // Changing it would redefine what everyone already agreed to.
    expect(screen.getByRole('radiogroup', { name: 'Players' })).toHaveAccessibleDescription(
      /fixed once you have invited someone/i,
    );
    expect(screen.getByRole('radio', { name: '3 Players' })).toBeDisabled();
  });

  it('lets the host start early, and says what that does', () => {
    social = base({ party });
    renderPage();

    const start = screen.getByRole('button', { name: 'Start now' });
    expect(start).toBeEnabled();
    expect(start).toHaveAttribute(
      'title',
      'Starts the game now with 2 players, without waiting for the rest',
    );

    fireEvent.click(start);
    expect(social.startParty).toHaveBeenCalled();
  });

  it('refuses to start below two players, and says how many are needed', () => {
    social = base({
      party: { ...party, players: [party.players[0]], canStart: false },
    });
    renderPage();

    const start = screen.getByRole('button', { name: 'Start now' });
    expect(start).toBeDisabled();
    expect(start).toHaveAttribute(
      'title',
      'You need at least 2 players — 1 player so far',
    );
  });

  it('marks an already-invited friend rather than offering again', () => {
    social = base({
      party: {
        ...party,
        players: [party.players[0]],
        invited: [{ user: { id: 'u-ann', handle: 'ann', name: 'Ann Lee' }, status: 'invited' }],
        canStart: false,
      },
    });
    renderPage();

    const invite = screen.getByRole('button', { name: 'Invite Ann Lee' });
    expect(invite).toBeDisabled();
    expect(invite).toHaveAttribute('title', 'Already invited');
  });
});
