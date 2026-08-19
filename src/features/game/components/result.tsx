import { memo, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui';
import { ordinal, plural, sentence } from '@/lib/a11y/phrases';
import type { GameResult, RankingEntry } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

/** Trophy + winner summary. */
export const ResultHeader = memo(function ResultHeader({
  result,
  headingRef,
}: {
  result: GameResult;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  /*
   * "You wins!" is what the mobile app renders — it interpolates the winner's
   * name straight into "<name> wins!", and the name for yourself is "You".
   * Its spoken announcement already special-cases this ("You win!"); the
   * visible heading never did. Fixed here rather than carried over.
   */
  const headline =
    result.winnerName === 'You' ? 'You win!' : `${result.winnerName} wins!`;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {/* Pure decoration — the heading below already says who won. */}
      <span
        aria-hidden="true"
        className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl">
        🏆
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        aria-label={sentence(
          headline,
          result.reason,
          `Game lasted ${plural(result.turns, 'turn')}`,
        )}
        className="text-2xl font-bold text-foreground outline-none">
        {headline}
      </h1>
      <p aria-hidden="true" className="text-sm text-muted-foreground">
        {result.reason}
      </p>
      <p aria-hidden="true" className="text-sm text-muted-foreground">
        Game lasted {result.turns} turns
      </p>
    </div>
  );
});

const PLACE_LABEL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
const PLACE_COLOR: Record<number, string> = {
  1: 'text-amber-400',
  2: 'text-muted-foreground',
  // The mobile app measured orange-700 at 3.46:1 on bg-card — below AA.
  // orange-400 is 7.9:1.
  3: 'text-orange-400',
};

/**
 * A single ranking row.
 *
 * Grouped into one node: place, avatar, name and detail are four stops
 * otherwise, and "1st" on its own tells you nothing about who came first.
 */
export const RankingRow = memo(function RankingRow({
  entry,
  seatIndex,
}: {
  entry: RankingEntry;
  seatIndex: number;
}) {
  return (
    <Card
      role="listitem"
      aria-label={sentence(
        `${ordinal(entry.place)} place`,
        entry.name,
        // The visible detail uses "·" as a separator, which a screen reader
        // either skips or reads as punctuation; spell it out instead.
        entry.detail.replace(' · ', ', '),
        entry.place === 1 ? 'Winner' : undefined,
      )}
      className="flex w-full items-center justify-between gap-4">
      <div aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className={cn(
            'w-8 shrink-0 text-center text-lg font-bold',
            PLACE_COLOR[entry.place] ?? 'text-muted-foreground',
          )}>
          {PLACE_LABEL[entry.place] ?? `${entry.place}th`}
        </span>
        <PlayerAvatar name={entry.name} seatIndex={seatIndex} size="lg" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold text-foreground">
            {entry.name}
          </span>
          <span className="text-sm text-muted-foreground">{entry.detail}</span>
        </span>
      </div>
      {entry.place === 1 ? (
        <span aria-hidden="true" className="text-lg text-amber-400">
          ★
        </span>
      ) : null}
    </Card>
  );
});
