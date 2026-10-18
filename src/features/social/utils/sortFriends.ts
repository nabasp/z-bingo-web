import type { Friend, Presence } from '../types';

/**
 * Availability order: who you can actually play with, first.
 *
 * Sorting has to happen on the client rather than in the server's snapshot,
 * because presence arrives as its own live events — a friend coming online
 * must move up the list without refetching it.
 *
 * Within a group the order is alphabetical by handle, which keeps the list
 * stable: someone's position only changes when their availability does, so a
 * screen-reader user re-reading the list is not hunting for a row that moved
 * for no reason.
 */
const RANK: Record<Presence, number> = {
  online: 0,
  in_game: 1,
  offline: 2,
};

export function sortFriends(friends: Friend[]): Friend[] {
  return [...friends].sort(
    (a, b) =>
      RANK[a.presence] - RANK[b.presence] || a.handle.localeCompare(b.handle),
  );
}

/** The friends who could accept an invitation right now. */
export function invitableFriends(friends: Friend[]): Friend[] {
  return sortFriends(friends).filter(friend => friend.presence === 'online');
}
