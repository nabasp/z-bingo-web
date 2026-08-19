import { Card } from '@/components/ui';
import type { Invitation } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

export interface InviteCardProps {
  invitation: Invitation;
  seatIndex?: number;
  onJoin: () => void;
  onDecline?: () => void;
  /** 'compact' (Home: title + Join) or 'full' (Join page: meta + Join). */
  variant?: 'compact' | 'full';
}

/** An incoming room invitation with a Join action. */
export function InviteCard({
  invitation,
  seatIndex = 1,
  onJoin,
  onDecline,
  variant = 'full',
}: InviteCardProps) {
  const primaryLine =
    variant === 'compact' ? `${invitation.fromName} invited you` : invitation.roomLabel;
  const secondaryLine =
    variant === 'compact'
      ? `Room ${invitation.roomLabel} · ${invitation.timeAgo}`
      : `${invitation.boardSize}×${invitation.boardSize} · ${invitation.players} players · ${invitation.timeAgo}`;

  return (
    <Card className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <PlayerAvatar name={invitation.fromName} seatIndex={seatIndex} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold text-foreground">
            {primaryLine}
          </span>
          <span className="truncate text-sm text-muted-foreground">{secondaryLine}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onDecline ? (
          <button
            type="button"
            onClick={onDecline}
            aria-label={`Decline invitation from ${invitation.fromName}`}
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-rose-400 hover:bg-rose-400/10">
            Decline
          </button>
        ) : null}
        <button
          type="button"
          onClick={onJoin}
          aria-label={`Join ${invitation.roomLabel}`}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Join
        </button>
      </div>
    </Card>
  );
}
