import { leaderboardEntryLabel, winRatePercent } from '../historyLabels';
import type { LeaderboardEntry } from '../history.types';

/**
 * Where the player stands, whether or not that is near the top.
 *
 * Its own titled section, so it can be reached by heading navigation — and
 * so a player ranked 27th, who is not on the first page of the list, still
 * has an answer to "where am I?".
 */
export function MyRankingCard({ me }: { me: LeaderboardEntry | null }) {
  return (
    <section
      aria-labelledby="my-ranking-heading"
      className={
        me
          ? 'w-full rounded-2xl border border-primary bg-primary/10 p-4'
          : 'w-full rounded-2xl border border-border bg-card p-4'
      }>
      <h2
        id="my-ranking-heading"
        className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Your ranking
      </h2>
      {me ? (
        <>
          <p className="sr-only">{leaderboardEntryLabel({ ...me, isYou: false })}</p>
          <div aria-hidden="true" className="mt-1 flex flex-col gap-1">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">#{me.rank}</span>
              <span className="truncate text-base font-semibold text-foreground">
                {me.displayName}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {me.gamesPlayed} games · {me.wins} wins · {winRatePercent(me.winRate)} win rate ·{' '}
              {me.points} points
            </span>
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Not ranked yet. Finish a game to appear on the leaderboard.
        </p>
      )}
    </section>
  );
}
