import { memo } from 'react';
import { Button, Card } from '@/components/ui';
import { sentence } from '@/lib/a11y/phrases';
import { PlayerAvatar } from '@/features/game/components';
import type { FriendRequest } from '../types';
import { userLabel } from '../a11y/socialSpeechEvents';

export interface RequestRowProps {
  request: FriendRequest;
  seatIndex: number;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}

/**
 * A pending friend request, incoming or outgoing.
 *
 * Direction is stated in words rather than implied by which buttons appear —
 * "sent you a friend request" versus "request sent", so a listener knows whose
 * move it is before reaching the controls.
 */
export const RequestRow = memo(function RequestRow({
  request,
  seatIndex,
  onAccept,
  onDecline,
  onCancel,
}: RequestRowProps) {
  const incoming = request.direction === 'incoming';
  const summary = incoming
    ? `${userLabel(request.user)} sent you a friend request`
    : `Friend request sent to ${userLabel(request.user)}, waiting for a reply`;

  return (
    <Card
      role="listitem"
      aria-label={sentence(summary)}
      className="flex w-full items-center justify-between gap-3">
      <div aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar name={request.user.name} seatIndex={seatIndex} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold text-foreground">
            {request.user.name}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            @{request.user.handle} · {incoming ? 'Wants to be friends' : 'Request sent'}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {incoming ? (
          <>
            <Button
              size="sm"
              aria-label={`Accept the friend request from ${request.user.name}`}
              onClick={onAccept}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Decline the friend request from ${request.user.name}`}
              onClick={onDecline}>
              Decline
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            aria-label={`Cancel your friend request to ${request.user.name}`}
            onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
});
