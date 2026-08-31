import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FriendRow } from './FriendRow';
import { RequestRow } from './RequestRow';
import { SearchResultRow } from './SearchResultRow';
import { InviteDialog } from './InviteDialog';
import type { Friend, FriendRequest, GameInvitePayload } from '../types';

/**
 * The accessibility contract of the social UI.
 *
 * These assert the properties a screen-reader user actually depends on: that a
 * row is one stop carrying its whole meaning, that status is never conveyed by
 * colour alone, and that an unavailable action explains itself instead of
 * being a silent dead control.
 */

afterEach(cleanup);

const friend: Friend = {
  id: 'u-ann',
  handle: 'ann',
  name: 'Ann Lee',
  presence: 'online',
};

describe('FriendRow', () => {
  it('reads as one stop carrying handle and availability', () => {
    render(
      <FriendRow friend={friend} seatIndex={0} onRemove={() => {}} />,
    );

    const row = screen.getByRole('listitem');
    // Split into separate stops, "Online" alone tells a listener nothing about
    // whom it describes.
    expect(row).toHaveAccessibleName('@ann, Ann Lee. Online');
  });

  it('does not read the visual content a second time', () => {
    render(
      <FriendRow friend={friend} seatIndex={0} onRemove={() => {}} />,
    );
    // The name/handle/badge block is hidden from assistive tech because the
    // row's own label already says all of it.
    expect(screen.getByText('@ann').closest('[aria-hidden="true"]')).not.toBeNull();
  });


  it('states availability in words, not only colour', () => {
    render(
      <FriendRow
        friend={{ ...friend, presence: 'in_game' }}
        seatIndex={0}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByRole('listitem')).toHaveAccessibleName(
      '@ann, Ann Lee. In a game',
    );
    expect(screen.getByText('In a game')).toBeTruthy();
  });



});

describe('RequestRow', () => {
  const request: FriendRequest = {
    id: 'pair-1',
    user: { id: 'u-cal', handle: 'cal', name: 'Cally' },
    direction: 'incoming',
    createdAt: 1,
  };

  const noop = () => {};

  it('says whose move it is, not just which buttons exist', () => {
    render(
      <RequestRow
        request={request}
        seatIndex={0}
        onAccept={noop}
        onDecline={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByRole('listitem')).toHaveAccessibleName(
      '@cal, Cally sent you a friend request',
    );
  });

  it('describes an outgoing request as waiting', () => {
    render(
      <RequestRow
        request={{ ...request, direction: 'outgoing' }}
        seatIndex={0}
        onAccept={noop}
        onDecline={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByRole('listitem')).toHaveAccessibleName(
      'Friend request sent to @cal, Cally, waiting for a reply',
    );
    expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull();
  });

  it('offers accept and decline on an incoming request', () => {
    const onAccept = vi.fn();
    render(
      <RequestRow
        request={request}
        seatIndex={0}
        onAccept={onAccept}
        onDecline={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Accept the friend request from Cally' }),
    );
    expect(onAccept).toHaveBeenCalledOnce();
  });
});

describe('SearchResultRow', () => {
  const user = { id: 'u-cal', handle: 'cal', name: 'Cally' };

  it('offers Add for a stranger', () => {
    render(
      <SearchResultRow user={user} seatIndex={0} relation="none" onAdd={() => {}} />,
    );
    expect(screen.getByRole('listitem')).toHaveAccessibleName('@cal, Cally');
    expect(
      screen.getByRole('button', { name: 'Send a friend request to Cally' }),
    ).toBeTruthy();
  });

  it('states an existing relationship instead of silently dropping the action', () => {
    render(
      <SearchResultRow user={user} seatIndex={0} relation="friend" onAdd={() => {}} />,
    );
    // A result with no button and no explanation leaves a listener wondering
    // whether they missed something.
    expect(screen.getByRole('listitem')).toHaveAccessibleName(
      '@cal, Cally. Already your friend',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says when a request is already pending', () => {
    render(
      <SearchResultRow user={user} seatIndex={0} relation="outgoing" onAdd={() => {}} />,
    );
    expect(screen.getByRole('listitem')).toHaveAccessibleName(
      '@cal, Cally. Request already sent',
    );
  });
});

describe('InviteDialog', () => {
  const invite: GameInvitePayload = {
    id: 'inv-1',
    from: { id: 'u-ann', handle: 'ann', name: 'Ann Lee' },
    targetPlayers: 3,
    expiresAt: Date.now() + 60_000,
  };

  it('is a modal dialog with a name and a description', () => {
    render(<InviteDialog invite={invite} onAccept={() => {}} onDecline={() => {}} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Game invitation');
    expect(dialog).toHaveAccessibleDescription(
      '@ann, Ann Lee invited you to a game. 3 players',
    );
  });

  it('names the sender in both actions', () => {
    render(<InviteDialog invite={invite} onAccept={() => {}} onDecline={() => {}} />);
    expect(
      screen.getByRole('button', {
        name: 'Accept the invitation from Ann Lee and join their game',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Decline the invitation from Ann Lee' }),
    ).toBeTruthy();
  });

  it('keeps the ticking countdown out of assistive tech', () => {
    render(<InviteDialog invite={invite} onAccept={() => {}} onDecline={() => {}} />);
    // Read every second, this would talk continuously over the player
    // deciding. The dialog announces the time at thresholds instead.
    const countdown = screen.getByText(/left to answer/);
    expect(countdown.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('refuses to accept an invitation that has run out', () => {
    render(
      <InviteDialog
        invite={{ ...invite, expiresAt: Date.now() - 1 }}
        onAccept={() => {}}
        onDecline={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Accept the invitation/ })).toBeDisabled();
    expect(screen.getByText('This invitation has expired')).toBeTruthy();
  });

  it('renders nothing when there is no invitation', () => {
    render(<InviteDialog invite={null} onAccept={() => {}} onDecline={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
