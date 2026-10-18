import { memo, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { leaderboardEntryLabel, winRatePercent } from '../historyLabels';
import type { LeaderboardEntry } from '../history.types';

export interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  /** Lets a list move focus here after loading the page this row is on. */
  rowRef?: Ref<HTMLLIElement>;
}

/**
 * One player on the leaderboard.
 *
 * Not a link: there is nowhere to go from another player's row. Read as one
 * sentence that names every number — "Rank 1. Ann. 125 points…" — because a
 * bare "1" or "125" heard in browse mode is a number of *what*?
 *
 * `tabIndex={-1}` makes it a focus target without adding it to the Tab order:
 * when "Load more" brings in a page, focus moves to that page's first row
 * rather than being lost.
 */
export const LeaderboardRow = memo(function LeaderboardRowView({
  entry,
  rowRef,
}: LeaderboardRowProps) {
  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      className={cn(
        'w-full rounded-2xl border p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        entry.isYou ? 'border-primary bg-primary/10' : 'border-border bg-card',
      )}>
      <span className="sr-only">{leaderboardEntryLabel(entry)}</span>
      <span aria-hidden="true" className="flex items-center gap-4">
        <span className="w-10 text-lg font-bold text-foreground">{entry.rank}.</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-base font-semibold text-foreground">
              {entry.displayName}
            </span>
            {entry.isYou ? (
              <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                You
              </span>
            ) : null}
          </span>
          <span className="text-sm text-muted-foreground">
            {entry.gamesPlayed} games · {entry.wins} wins · {winRatePercent(entry.winRate)}
          </span>
        </span>
        <span className="text-base font-semibold text-foreground">{entry.points} pts</span>
      </span>
    </li>
  );
});
