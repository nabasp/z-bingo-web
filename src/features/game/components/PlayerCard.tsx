import { memo } from 'react';
import { Card } from '@/components/ui';
import { sentence } from '@/lib/a11y/phrases';
import type { Player } from '../types';
import { PlayerAvatar } from './PlayerAvatar';
import { SpeakingRipple } from '@/features/voice';
import { HostBadge, ReadyBadge, StatusBadge } from './badges';

export interface PlayerCardProps {
  player: Player;
  seatIndex: number;
}

/**
 * Lobby player row: avatar, name (+ HOST), status line, ready pill.
 *
 * The whole row is one screen-reader stop with a composed label — read as four
 * separate stops, "Ready" on its own tells you nothing about who is ready.
 */
export const PlayerCard = memo(function PlayerCard({ player, seatIndex }: PlayerCardProps) {
  const displayName = player.isYou ? 'You' : player.name;

  return (
    <Card
      role="listitem"
      aria-label={sentence(
        displayName,
        player.isHost ? 'Host' : undefined,
        player.ready === 'ready' ? 'Ready' : 'Not ready',
        player.connection === 'disconnected' ? 'Disconnected' : undefined,
      )}
      className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar name={displayName} seatIndex={seatIndex} size="lg" />
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-base font-semibold text-foreground">
              {displayName}
            </span>
            {player.isHost ? <HostBadge /> : null}
            {/* Beside the name, where the eye already is when you wonder who
                is talking. Decorative — the mic state below says it in words. */}
            <SpeakingRipple playerId={player.id} />
          </span>
          <StatusBadge connection={player.connection} playerId={player.id} />
        </div>
      </div>
      <span aria-hidden="true">
        <ReadyBadge status={player.ready} />
      </span>
    </Card>
  );
});
