import { memo } from 'react';
import { Button, Card } from '@/components/ui';
import { sentence } from '@/lib/a11y/phrases';
import { PlayerAvatar } from '@/features/game/components';
import type { Friend } from '../types';
import { presenceLabel, userLabel } from '../a11y/socialSpeechEvents';
import { PresenceBadge } from './PresenceBadge';

export interface FriendRowProps {
  friend: Friend;
  seatIndex: number;
  /** Absent while this player is not in a room with space to fill. */
  onInvite?: () => void;
  onRemove: () => void;
  /** True while an invitation to this friend is still outstanding. */
  invitePending?: boolean;
}

/**
 * One friend, as one screen-reader stop.
 *
 * The row carries the whole meaning — who, their handle, whether they can be
 * invited — in a single composed label, following `PlayerCard`. Split across
 * four stops, "Online" on its own tells the listener nothing about whom it
 * describes, and they have to hold the name in their head while they navigate.
 *
 * The visual content is `aria-hidden`, so the same information is never read
 * twice. The buttons stay outside that, since they are separate stops with
 * their own labels and hints.
 */
export const FriendRow = memo(function FriendRow({
  friend,
  seatIndex,
  onInvite,
  onRemove,
  invitePending = false,
}: FriendRowProps) {
  const canInvite = Boolean(onInvite) && friend.presence === 'online' && !invitePending;

  // Say why the action is unavailable, rather than leaving a disabled control
  // the listener has to guess about.
  const inviteHint = invitePending
    ? 'Invitation already sent'
    : friend.presence === 'in_game'
      ? 'They are already in a game'
      : friend.presence === 'offline'
        ? 'They are offline'
        : !onInvite
          ? 'Create or join a room first'
          : `Invites ${friend.name} to your room`;

  return (
    <Card
      role="listitem"
      aria-label={sentence(
        userLabel(friend),
        presenceLabel(friend.presence),
        invitePending ? 'Invitation sent' : undefined,
      )}
      className="flex w-full items-center justify-between gap-3">
      <div aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar name={friend.name} seatIndex={seatIndex} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold text-foreground">
            {friend.name}
          </span>
          <span className="flex items-center gap-2">
            <span className="truncate text-sm text-muted-foreground">
              @{friend.handle}
            </span>
            <PresenceBadge presence={friend.presence} />
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          disabled={!canInvite}
          aria-label={`Invite ${friend.name} to your game`}
          title={inviteHint}
          onClick={() => onInvite?.()}>
          {invitePending ? 'Invited' : 'Invite'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Remove ${friend.name} from your friends`}
          onClick={onRemove}>
          Remove
        </Button>
      </div>
    </Card>
  );
});
