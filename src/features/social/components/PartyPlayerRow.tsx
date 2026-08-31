import { memo } from 'react';
import { Card } from '@/components/ui';
import { sentence } from '@/lib/a11y/phrases';
import { PlayerAvatar } from '@/features/game/components';
import type { InviteeStatus, PublicUser } from '../types';
import { userLabel } from '../a11y/socialSpeechEvents';

export interface PartyPlayerRowProps {
  user: PublicUser;
  seatIndex: number;
  status: InviteeStatus | 'host';
}

const STATUS_LABEL: Record<InviteeStatus | 'host', string> = {
  host: 'You are hosting',
  accepted: 'Accepted',
  invited: 'Invited, waiting for an answer',
  declined: 'Declined',
  expired: 'Did not answer in time',
};

/**
 * One person in the game being assembled.
 *
 * Status is a full phrase rather than a word, because it is the whole reason
 * the row is on screen: "Invited" alone leaves a listener unsure whether that
 * means they are in.
 */
export const PartyPlayerRow = memo(function PartyPlayerRow({
  user,
  seatIndex,
  status,
}: PartyPlayerRowProps) {
  return (
    <Card
      role="listitem"
      aria-label={sentence(userLabel(user), STATUS_LABEL[status])}
      className="flex w-full items-center justify-between gap-3">
      <div aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar name={user.name} seatIndex={seatIndex} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold text-foreground">
            {user.name}
          </span>
          <span className="truncate text-sm text-muted-foreground">@{user.handle}</span>
        </div>
      </div>
      <span
        aria-hidden="true"
        className={`shrink-0 text-sm ${
          status === 'accepted' || status === 'host'
            ? 'text-emerald-400'
            : status === 'invited'
              ? 'text-muted-foreground'
              : 'text-amber-400'
        }`}>
        {STATUS_LABEL[status]}
      </span>
    </Card>
  );
});
