import { SectionLabel } from '@/components/ui';
import type { Player } from '../types';
import { PlayerCard } from './PlayerCard';
import { EmptyPlayerSlot } from './EmptyPlayerSlot';

export interface PlayerListProps {
  players: Player[];
  maxPlayers: number;
  boardSize?: number;
}

/** Player roster with a header count and dashed slots for empty seats. */
export function PlayerList({ players, maxPlayers, boardSize }: PlayerListProps) {
  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <section className="flex w-full flex-col gap-3" aria-label="Players">
      <div className="flex items-center justify-between">
        <SectionLabel>
          Players ({players.length}/{maxPlayers})
        </SectionLabel>
        {boardSize ? (
          <span className="text-sm text-muted-foreground">
            {boardSize}×{boardSize} board
          </span>
        ) : null}
      </div>

      <ul className="flex list-none flex-col gap-3 p-0">
        {players.map((player, index) => (
          <PlayerCard key={player.id} player={player} seatIndex={index} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptyPlayerSlot key={`empty-${i}`} />
        ))}
      </ul>
    </section>
  );
}
