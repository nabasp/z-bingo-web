import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeading, PageShell, TextLink } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { PATHS } from '@/routes/paths';
import { ErrorState, LoadingState } from '../components';
import { historyApi } from '../history.api';
import {
  dateShort,
  detailsPlayerLabel,
  detailsSummary,
  durationShort,
  durationSpoken,
  gameTitle,
  rankShort,
  resultWord,
  timeShort,
} from '../historyLabels';
import type { GameDetails } from '../history.types';
import { useRequest } from '../hooks';

/**
 * One game, after the fact.
 *
 * Shows only what the player already saw at the table: names, letters
 * earned, finishing order. Nobody's board is stored, so nobody's board can be
 * shown — and a game the player was not in comes back as "not found".
 */
export function GameDetailsPage() {
  const { gameId = '' } = useParams();
  const fetchGame = useCallback(async () => (await historyApi.game(gameId)).game, [gameId]);
  const request = useRequest<GameDetails>(gameId, fetchGame);
  const game = request.data;

  const headingRef = useAnnounceOnFocus({ title: 'Game results', key: gameId });

  return (
    <PageShell>
      <TextLink to={PATHS.history} label="← Back to game history" />

      <PageHeading
        headingRef={headingRef}
        title={game ? gameTitle(game.shortId) : 'Game Results'}
        subtitle={game ? detailsSummary(game) : undefined}
      />

      {request.status === 'loading' ? <LoadingState label="Loading the game" /> : null}

      {request.status === 'error' && request.error ? (
        <ErrorState message={request.error} onRetry={request.reload} />
      ) : null}

      {game ? (
        <>
          {/* A description list: each fact is a term and its value, which is
              how a screen reader will pair them. */}
          <dl className="grid w-full grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="text-foreground">
              {dateShort(game.endedAt)} at {timeShort(game.endedAt)}
            </dd>
            {game.status === 'completed' ? (
              <>
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="text-foreground">
                  <span aria-hidden="true">{durationShort(game.durationMs)}</span>
                  <span className="sr-only">{durationSpoken(game.durationMs)}</span>
                </dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Board</dt>
            <dd className="text-foreground">
              {game.size} by {game.size}
            </dd>
            <dt className="text-muted-foreground">Word</dt>
            <dd className="text-foreground">{game.word}</dd>
          </dl>

          <section aria-labelledby="standings-heading" className="flex w-full flex-col gap-3">
            <h2 id="standings-heading" className="text-lg font-semibold text-foreground">
              Final standings
            </h2>
            <ol className="flex w-full flex-col gap-3">
              {game.players.map(player => (
                <li
                  key={`${player.seat}-${player.name}`}
                  className={cn(
                    'w-full rounded-2xl border p-4',
                    player.isYou ? 'border-primary bg-primary/10' : 'border-border bg-card',
                  )}>
                  <span className="sr-only">{detailsPlayerLabel(player)}</span>
                  <span aria-hidden="true" className="flex items-center gap-4">
                    <span className="w-12 text-lg font-bold text-foreground">
                      {rankShort(player.rank)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-base font-semibold text-foreground">
                        {player.name}
                        {player.isYou ? ' (you)' : ''}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {resultWord(player.result)} · {player.letters} letters
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
