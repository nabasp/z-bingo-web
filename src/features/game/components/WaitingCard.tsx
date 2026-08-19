import { Spinner } from '@/components/ui';
import type { Player } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

export interface WaitingCardProps {
  title: string;
  subtitle: string;
  readyCount: number;
  totalCount: number;
  players: Player[];
  /** Player ids considered "done"/ready. */
  doneIds: Set<string>;
}

/** Loading state with a progress bar and per-player ready status. */
export function WaitingCard({
  title,
  subtitle,
  readyCount,
  totalCount,
  players,
  doneIds,
}: WaitingCardProps) {
  const pct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <Spinner size="lg" label={null} className="text-primary" />

      <div className="flex flex-col items-center gap-1 text-center">
        <h1 tabIndex={-1} className="text-xl font-bold text-foreground outline-none">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex w-full max-w-[320px] flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Players ready</span>
          <span className="text-sm font-semibold text-foreground">
            {readyCount} of {totalCount}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={readyCount}
          aria-label="Boards locked in"
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="flex w-full max-w-[320px] list-none flex-col gap-2 p-0">
        {players.map((player, i) => {
          const name = player.isYou ? 'You' : player.name;
          const done = doneIds.has(player.id);
          return (
            <li
              key={player.id}
              aria-label={`${name}, ${done ? 'board locked in' : 'still setting up'}`}
              className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
              <span aria-hidden="true" className="flex items-center gap-2">
                <PlayerAvatar name={name} seatIndex={i} size="sm" />
                <span className="text-sm font-medium text-foreground">{name}</span>
              </span>
              {done ? (
                <span aria-hidden="true" className="text-base font-bold text-emerald-400">
                  ✓
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border-2 border-muted-foreground"
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
