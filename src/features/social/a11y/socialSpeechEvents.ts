/**
 * What to say when the social state changes.
 *
 * A pure `derive(prev, next) → SpeechEvent[]`, mirroring
 * `features/game/a11y/gameSpeechEvents.ts`, so the whole commentary is
 * testable without a socket or a screen reader.
 *
 * The hard part of speaking a friends list is not wording — it is restraint.
 * Everything here competes with whatever the player is actually doing, so each
 * rule below decides *whether* to speak as much as what.
 */

import { plural, sentence } from '@/lib/a11y/phrases';
import type {
  Friend,
  FriendRequest,
  GameInvitePayload,
  PartySnapshot,
  Presence,
} from '../types';

export interface SpeechEvent {
  text: string;
  /** Same scale as the game's events, so the two stay comparable. */
  priority: number;
  /** Interrupts and clears the queue. */
  assertive?: boolean;
  dedupeKey?: string;
}

export interface SocialState {
  friends: Friend[];
  requests: FriendRequest[];
  incomingInvite: GameInvitePayload | null;
  /** The game being assembled, if this player is in one. */
  party: PartySnapshot | null;
}

export interface SpeechContext {
  /**
   * Whether the player is looking at the Friends screen.
   *
   * Presence chatter is only announced here. A friend going offline is worth
   * knowing while you are choosing who to invite, and pure noise while you are
   * mid-turn in a game — the same event, two completely different values.
   */
  onFriendsScreen: boolean;
}

/** How a presence value is spoken. Never a colour, never a bare dot. */
export function presenceLabel(presence: Presence): string {
  switch (presence) {
    case 'online':
      return 'Online';
    case 'in_game':
      return 'In a game';
    default:
      return 'Offline';
  }
}

/** "@alex, Alex Kim" — handle first, because that is what you search by. */
export function userLabel(user: { handle: string; name: string }): string {
  return user.name && user.name !== user.handle
    ? `@${user.handle}, ${user.name}`
    : `@${user.handle}`;
}

export function deriveSocialSpeechEvents(
  prev: SocialState | null,
  next: SocialState,
  { onFriendsScreen }: SpeechContext,
): SpeechEvent[] {
  // Nothing to diff against on the first snapshot — announcing the whole list
  // on arrival is the screen's own job, not a change notification.
  if (!prev) return [];

  const events: SpeechEvent[] = [];

  // ── An invitation arrived ──────────────────────────────────────────────────
  // Assertive, and the highest priority here: it is time-limited, and a player
  // who misses it loses the game they were being offered.
  if (next.incomingInvite && next.incomingInvite.id !== prev.incomingInvite?.id) {
    const invite = next.incomingInvite;
    events.push({
      text: sentence(
        `${userLabel(invite.from)} invited you to a game`,
        `${plural(invite.targetPlayers, 'player')}`,
        'Open the invitation to accept or decline',
      ),
      priority: 90,
      assertive: true,
      dedupeKey: `invite:${invite.id}`,
    });
  }

  // ── The game being assembled filled up a little ───────────────────────────
  // Only the arrivals are spoken. A host waiting on friends needs to hear that
  // someone said yes and how close it now is, and nothing else about it.
  if (next.party && prev.party?.id === next.party.id) {
    const before = new Set(prev.party.players.map(player => player.id));
    const joined = next.party.players.filter(player => !before.has(player.id));

    if (joined.length > 0) {
      events.push({
        text: sentence(
          joined.length === 1
            ? `${userLabel(joined[0])} accepted`
            : `${plural(joined.length, 'player')} accepted`,
          `${next.party.players.length} of ${next.party.targetPlayers} players`,
          next.party.canStart && next.party.players.length < next.party.targetPlayers
            ? 'You can start now, or wait for more'
            : undefined,
        ),
        priority: 55,
        dedupeKey: `party:${next.party.id}:${next.party.players.length}`,
      });
    }
  }

  // ── Somebody asked to be friends ───────────────────────────────────────────
  const knownRequests = new Set(prev.requests.map(r => r.id));
  for (const request of next.requests) {
    if (knownRequests.has(request.id) || request.direction !== 'incoming') continue;
    events.push({
      text: `${userLabel(request.user)} sent you a friend request`,
      priority: 50,
      dedupeKey: `request:${request.id}`,
    });
  }

  // ── A request you sent was accepted ────────────────────────────────────────
  const knownFriends = new Set(prev.friends.map(f => f.id));
  const added = next.friends.filter(f => !knownFriends.has(f.id));
  if (added.length > 0) {
    events.push({
      text:
        added.length === 1
          ? `${userLabel(added[0])} is now your friend`
          : `${plural(added.length, 'new friend')} added`,
      priority: 45,
      dedupeKey: `added:${added.map(f => f.id).join(',')}`,
    });
  }

  // ── Presence, only where it is useful ─────────────────────────────────────
  if (onFriendsScreen) {
    const before = new Map(prev.friends.map(f => [f.id, f.presence]));
    const changed = next.friends.filter(
      f => before.has(f.id) && before.get(f.id) !== f.presence,
    );

    // One friend flipping is worth naming; five at once is a list nobody can
    // follow by ear, so it collapses into a count.
    if (changed.length === 1) {
      const friend = changed[0];
      events.push({
        text: `${userLabel(friend)} is now ${presenceLabel(friend.presence).toLowerCase()}`,
        priority: 20,
        dedupeKey: `presence:${friend.id}:${friend.presence}`,
      });
    } else if (changed.length > 1) {
      events.push({
        text: `${plural(changed.length, 'friend')} changed availability`,
        priority: 20,
        dedupeKey: `presence:bulk:${changed.length}`,
      });
    }
  }

  return events;
}
