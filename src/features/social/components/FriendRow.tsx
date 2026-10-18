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
  onRemove: () => void;
}

/**
 * One friend, as one screen-reader stop.
 *
 * The row carries the whole meaning — who, their handle, whether they are
 * available — in a single composed label, following `PlayerCard`. Split across
 * three stops, "Online" on its own tells the listener nothing about whom it
 * describes, and they have to hold the name in their head while they navigate.
 *
 * Inviting deliberately does NOT live here. This page is for managing friends;
 * starting a game with them is what Play with Friends is for, where you choose
 * how many players first.
 *
 * The visual content is `aria-hidden`, so the same information is never read
 * twice. The buttons stay outside that, since they are separate stops with
 * their own labels and hints.
 */
export const FriendRow = memo(function FriendRow({
  friend,
  seatIndex,
  onRemove,
}: FriendRowProps) {
  return (
    <Card
      role="listitem"
      aria-label={sentence(userLabel(friend), presenceLabel(friend.presence))}
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
          variant="outline"
          aria-label={`Remove ${friend.name} from your friends`}
          onClick={onRemove}>
          Remove
        </Button>
      </div>
    </Card>
  );
});
