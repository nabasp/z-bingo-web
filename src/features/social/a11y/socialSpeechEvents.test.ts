import { describe, expect, it } from 'vitest';
import {
  deriveSocialSpeechEvents,
  presenceLabel,
  userLabel,
  type SocialState,
} from './socialSpeechEvents';
import type {
  Friend,
  FriendRequest,
  GameInvitePayload,
  PartySnapshot,
} from '../types';

/**
 * What the app says when the social state changes.
 *
 * These are the assertions that matter for a player who cannot see the screen:
 * not only that something is spoken, but that the *right* things are — and
 * that the noisy things are not.
 */

const ann: Friend = {
  id: 'u-ann',
  handle: 'ann',
  name: 'Ann Lee',
  presence: 'online',
};
const bob: Friend = { id: 'u-bob', handle: 'bob', name: 'Bob', presence: 'offline' };

function state(overrides: Partial<SocialState> = {}): SocialState {
  return {
    friends: [],
    requests: [],
    incomingInvite: null,
    party: null,
    ...overrides,
  };
}

const request: FriendRequest = {
  id: 'pair-1',
  user: { id: 'u-cal', handle: 'cal', name: 'Cally' },
  direction: 'incoming',
  createdAt: 1,
};

const invite: GameInvitePayload = {
  id: 'inv-1',
  from: { id: 'u-ann', handle: 'ann', name: 'Ann Lee' },
  targetPlayers: 3,
  expiresAt: Date.now() + 60_000,
};

const onScreen = { onFriendsScreen: true };
const offScreen = { onFriendsScreen: false };

describe('spoken labels', () => {
  it('never describes availability by colour alone', () => {
    expect(presenceLabel('online')).toBe('Online');
    expect(presenceLabel('in_game')).toBe('In a game');
    expect(presenceLabel('offline')).toBe('Offline');
  });

  it('leads with the handle, which is what you search by', () => {
    expect(userLabel(ann)).toBe('@ann, Ann Lee');
  });

  it('does not repeat a name that is the same as the handle', () => {
    expect(userLabel({ handle: 'bob', name: 'bob' })).toBe('@bob');
  });
});

describe('deriveSocialSpeechEvents', () => {
  it('says nothing on the very first snapshot', () => {
    // Arriving on a screen is the screen's own announcement to make; reading
    // the whole list as "changes" would be wrong and long.
    expect(deriveSocialSpeechEvents(null, state({ friends: [ann] }), onScreen)).toEqual([]);
  });

  it('announces an incoming invitation assertively', () => {
    const events = deriveSocialSpeechEvents(
      state(),
      state({ incomingInvite: invite }),
      offScreen,
    );

    expect(events).toHaveLength(1);
    // Assertive because it is time-limited: a player who misses it loses the
    // game they were being offered.
    expect(events[0].assertive).toBe(true);
    expect(events[0].text).toContain('@ann');
    expect(events[0].text).toContain('3 players');
  });

  it('announces an invitation even away from the friends screen', () => {
    const events = deriveSocialSpeechEvents(
      state(),
      state({ incomingInvite: invite }),
      offScreen,
    );
    expect(events).toHaveLength(1);
  });

  it('does not re-announce the same invitation', () => {
    const before = state({ incomingInvite: invite });
    expect(deriveSocialSpeechEvents(before, before, offScreen)).toEqual([]);
  });

  it('announces an incoming friend request', () => {
    const events = deriveSocialSpeechEvents(
      state(),
      state({ requests: [request] }),
      offScreen,
    );
    expect(events).toHaveLength(1);
    expect(events[0].text).toContain('sent you a friend request');
    // Polite: it can wait for a gap in whatever the player is doing.
    expect(events[0].assertive).toBeUndefined();
  });

  it('stays quiet about requests the player sent themselves', () => {
    const outgoing: FriendRequest = { ...request, direction: 'outgoing' };
    expect(
      deriveSocialSpeechEvents(state(), state({ requests: [outgoing] }), onScreen),
    ).toEqual([]);
  });

  it('announces a new friend', () => {
    const events = deriveSocialSpeechEvents(
      state(),
      state({ friends: [ann] }),
      offScreen,
    );
    expect(events[0].text).toBe('@ann, Ann Lee is now your friend');
  });

  it('collapses several new friends into a count', () => {
    const events = deriveSocialSpeechEvents(
      state(),
      state({ friends: [ann, bob] }),
      offScreen,
    );
    expect(events[0].text).toBe('2 new friends added');
  });

  it('announces a presence change on the friends screen', () => {
    const events = deriveSocialSpeechEvents(
      state({ friends: [ann] }),
      state({ friends: [{ ...ann, presence: 'in_game' }] }),
      onScreen,
    );
    expect(events).toHaveLength(1);
    expect(events[0].text).toBe('@ann, Ann Lee is now in a game');
  });

  it('stays silent about presence anywhere else', () => {
    // The same event is useful while choosing who to invite and pure noise
    // mid-turn in a game.
    const events = deriveSocialSpeechEvents(
      state({ friends: [ann] }),
      state({ friends: [{ ...ann, presence: 'offline' }] }),
      offScreen,
    );
    expect(events).toEqual([]);
  });

  it('collapses a burst of presence changes into a count', () => {
    const events = deriveSocialSpeechEvents(
      state({ friends: [ann, bob] }),
      state({
        friends: [
          { ...ann, presence: 'offline' },
          { ...bob, presence: 'online' },
        ],
      }),
      onScreen,
    );
    expect(events).toHaveLength(1);
    expect(events[0].text).toBe('2 friends changed availability');
  });

  it('says nothing when a friend appears without a presence change', () => {
    const before = state({ friends: [ann] });
    expect(deriveSocialSpeechEvents(before, before, onScreen)).toEqual([]);
  });

  it('announces an acceptance and how close the game now is', () => {
    const before: PartySnapshot = {
      id: 'p1',
      host: { id: 'u-me', handle: 'me', name: 'Me' },
      targetPlayers: 3,
      players: [{ id: 'u-me', handle: 'me', name: 'Me' }],
      invited: [],
      canStart: false,
    };
    const after: PartySnapshot = {
      ...before,
      players: [...before.players, { id: 'u-ann', handle: 'ann', name: 'Ann Lee' }],
      canStart: true,
    };

    const events = deriveSocialSpeechEvents(
      state({ party: before }),
      state({ party: after }),
      offScreen,
    );

    // A host waiting on friends needs to hear who said yes and how close it is
    // — this is the only feedback they get.
    expect(events).toHaveLength(1);
    expect(events[0].text).toContain('@ann, Ann Lee accepted');
    expect(events[0].text).toContain('2 of 3 players');
    expect(events[0].text).toContain('You can start now');
  });

  it('says nothing about a game that has not changed', () => {
    const party: PartySnapshot = {
      id: 'p1',
      host: { id: 'u-me', handle: 'me', name: 'Me' },
      targetPlayers: 2,
      players: [{ id: 'u-me', handle: 'me', name: 'Me' }],
      invited: [],
      canStart: false,
    };
    expect(
      deriveSocialSpeechEvents(state({ party }), state({ party }), onScreen),
    ).toEqual([]);
  });

  it('gives every event a dedupe key so repeats collapse', () => {
    const events = deriveSocialSpeechEvents(
      state(),
      state({ incomingInvite: invite, requests: [request], friends: [ann] }),
      onScreen,
    );
    expect(events.length).toBeGreaterThan(1);
    for (const event of events) expect(event.dedupeKey).toBeTruthy();
  });

  it('ranks an invitation above a friend request', () => {
    const events = deriveSocialSpeechEvents(
      state(),
      state({ incomingInvite: invite, requests: [request] }),
      onScreen,
    );
    const inviteEvent = events.find(e => e.text.includes('invited you'));
    const requestEvent = events.find(e => e.text.includes('friend request'));
    expect(inviteEvent!.priority).toBeGreaterThan(requestEvent!.priority);
  });
});
