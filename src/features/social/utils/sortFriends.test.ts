import { describe, expect, it } from 'vitest';
import { invitableFriends, sortFriends } from './sortFriends';
import type { Friend } from '../types';

/**
 * Availability ordering.
 *
 * This matters most to someone navigating the list linearly: the people they
 * can actually play with have to come first, or they swipe past every offline
 * friend to reach anyone.
 */
function friend(handle: string, presence: Friend['presence']): Friend {
  return { id: `u-${handle}`, handle, name: handle, presence };
}

describe('sortFriends', () => {
  it('puts available friends first, then in-game, then offline', () => {
    const sorted = sortFriends([
      friend('zoe', 'offline'),
      friend('bob', 'in_game'),
      friend('ann', 'online'),
    ]);
    expect(sorted.map(f => f.handle)).toEqual(['ann', 'bob', 'zoe']);
  });

  it('is alphabetical within a group', () => {
    const sorted = sortFriends([
      friend('zoe', 'online'),
      friend('ann', 'online'),
      friend('mia', 'online'),
    ]);
    expect(sorted.map(f => f.handle)).toEqual(['ann', 'mia', 'zoe']);
  });

  it('only moves someone when their availability changes', () => {
    // A stable order is what stops a row jumping under a listener who is
    // partway through the list.
    const before = sortFriends([friend('ann', 'online'), friend('bob', 'online')]);
    const after = sortFriends([friend('bob', 'online'), friend('ann', 'online')]);
    expect(before.map(f => f.handle)).toEqual(after.map(f => f.handle));
  });

  it('does not mutate the array it was given', () => {
    const original = [friend('zoe', 'offline'), friend('ann', 'online')];
    sortFriends(original);
    expect(original.map(f => f.handle)).toEqual(['zoe', 'ann']);
  });

  it('handles an empty list', () => {
    expect(sortFriends([])).toEqual([]);
  });
});

describe('invitableFriends', () => {
  it('keeps only those who could accept right now', () => {
    const invitable = invitableFriends([
      friend('ann', 'online'),
      friend('bob', 'in_game'),
      friend('zoe', 'offline'),
    ]);
    // Someone mid-game cannot accept, so offering them is a promise the server
    // would refuse.
    expect(invitable.map(f => f.handle)).toEqual(['ann']);
  });
});
