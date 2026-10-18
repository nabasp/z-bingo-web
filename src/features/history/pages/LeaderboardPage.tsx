import { useCallback, useEffect, useRef } from 'react';
import { Banner, PageHeading, PageShell } from '@/components/ui';
import { announcer, TIER } from '@/lib/a11y/Announcer';
import { plural } from '@/lib/a11y/phrases';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import {
  EmptyState,
  ErrorState,
  LeaderboardRow,
  LoadMoreButton,
  LoadingState,
  MyRankingCard,
} from '../components';
import { historyApi } from '../history.api';
import type { LeaderboardEntry } from '../history.types';
import { useFocusOnLoadMore, usePagedList, useRequest } from '../hooks';

const PAGE_SIZE = 20;

/**
 * Top players, and where you stand.
 *
 * Your own ranking comes first: on a page read top to bottom, the one row that
 * is about you should not be twenty rows down — and it may not be on this page
 * at all.
 */
export function LeaderboardPage() {
  const fetchPage = useCallback(async (cursor?: string) => {
    const page = await historyApi.leaderboard({ limit: PAGE_SIZE, cursor });
    return { items: page.players, nextCursor: page.nextCursor };
  }, []);
  const list = usePagedList<LeaderboardEntry>('all', fetchPage);
  const { refFor, loadMore } = useFocusOnLoadMore<HTMLLIElement>(list);

  const fetchMe = useCallback(async () => (await historyApi.me()).me, []);
  const me = useRequest('me', fetchMe);

  const headingRef = useAnnounceOnFocus({
    title: 'Leaderboard',
    detail:
      'All time. Your ranking first, then the top players. 3 points for a win, 1 for finishing a game, none for leaving.',
  });

  const shown = useRef<number | null>(null);
  useEffect(() => {
    if (list.status !== 'ready' || list.loadingMore) return;
    const before = shown.current;
    shown.current = list.items.length;
    if (before !== null && list.items.length > before) {
      announcer.speak(
        `${plural(list.items.length - before, 'more player')} loaded.`,
        TIER.notify,
      );
    }
  }, [list.status, list.loadingMore, list.items.length]);

  return (
    <PageShell>
      <PageHeading
        headingRef={headingRef}
        title="Leaderboard"
        subtitle="3 points for a win, 1 for finishing a game, none for leaving"
      />

      {me.status === 'ready' ? <MyRankingCard me={me.data ?? null} /> : null}

      <section aria-labelledby="top-players-heading" className="flex w-full flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="top-players-heading" className="text-lg font-semibold text-foreground">
            Top players
          </h2>
          <p className="text-sm text-muted-foreground">All time</p>
        </div>

        {list.status === 'loading' ? <LoadingState label="Loading the leaderboard" /> : null}

        {list.status === 'error' && list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : null}

        {list.status === 'ready' && list.items.length === 0 ? (
          <EmptyState
            title="No rankings yet"
            body="Play some games to appear on the leaderboard."
          />
        ) : null}

        {list.items.length > 0 ? (
          <ul aria-label="Top players" className="flex w-full flex-col gap-3">
            {/* Keyed by position: rows carry no id on purpose (no uids on the
                wire), names repeat, and this list only ever grows at the end. */}
            {list.items.map((entry, index) => (
              <LeaderboardRow key={index} entry={entry} rowRef={refFor(index)} />
            ))}
          </ul>
        ) : null}

        {list.status === 'ready' && list.error ? (
          <Banner variant="error">{list.error}</Banner>
        ) : null}

        {list.status === 'ready' && list.hasMore ? (
          <LoadMoreButton label="Load more players" loading={list.loadingMore} onPress={loadMore} />
        ) : null}
      </section>
    </PageShell>
  );
}
