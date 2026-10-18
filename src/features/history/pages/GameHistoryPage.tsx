import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, PageHeading, PageShell } from '@/components/ui';
import { announcer, TIER } from '@/lib/a11y/Announcer';
import { plural } from '@/lib/a11y/phrases';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { PATHS } from '@/routes/paths';
import {
  EmptyState,
  ErrorState,
  FilterTabs,
  HistoryRow,
  LoadMoreButton,
  LoadingState,
} from '../components';
import { historyApi } from '../history.api';
import type { HistoryFilter, HistoryItem } from '../history.types';
import { useFocusOnLoadMore, usePagedList } from '../hooks';

const PAGE_SIZE = 20;

const EMPTY: Record<HistoryFilter, { title: string; body: string }> = {
  all: {
    title: 'No games yet',
    body: 'Join a bingo game to start building your game history.',
  },
  wins: { title: 'No wins yet', body: 'Your wins will appear here.' },
  losses: { title: 'No losses', body: 'Games you did not win will appear here.' },
};

const FILTER_NAME: Record<HistoryFilter, string> = {
  all: 'all games',
  wins: 'wins',
  losses: 'losses',
};

/** Every game the player has finished, newest first. */
export function GameHistoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const page = await historyApi.games({ filter, limit: PAGE_SIZE, cursor });
      return { items: page.games, nextCursor: page.nextCursor };
    },
    [filter],
  );
  const list = usePagedList<HistoryItem>(filter, fetchPage);
  const { refFor, loadMore } = useFocusOnLoadMore<HTMLAnchorElement>(list);

  const headingRef = useAnnounceOnFocus({
    title: 'Game history',
    detail: 'Your finished games, newest first. Choose All, Wins or Losses to filter.',
  });

  /**
   * Say what changed, once it has: how many games a filter shows, or how many
   * a "Load more" brought in. Polite — neither is urgent.
   */
  const spokenFor = useRef<{ filter: HistoryFilter; count: number } | null>(null);
  useEffect(() => {
    if (list.status !== 'ready' || list.loadingMore) return;
    const previous = spokenFor.current;
    spokenFor.current = { filter, count: list.items.length };
    if (!previous) return;

    if (previous.filter !== filter) {
      announcer.speak(
        `Showing ${FILTER_NAME[filter]}. ${plural(list.items.length, 'game')}${
          list.hasMore ? ', more available' : ''
        }.`,
        TIER.notify,
      );
    } else if (list.items.length > previous.count) {
      announcer.speak(
        `${plural(list.items.length - previous.count, 'more game')} loaded.`,
        TIER.notify,
      );
    }
  }, [list.status, list.loadingMore, list.items.length, list.hasMore, filter]);

  return (
    <PageShell>
      <PageHeading
        headingRef={headingRef}
        title="Game History"
        subtitle="Your finished games, newest first"
      />

      <FilterTabs value={filter} onChange={setFilter} />

      {list.status === 'loading' ? <LoadingState label="Loading your games" /> : null}

      {list.status === 'error' && list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : null}

      {list.status === 'ready' && list.items.length === 0 ? (
        <EmptyState
          title={EMPTY[filter].title}
          body={EMPTY[filter].body}
          actionLabel={filter === 'all' ? 'Find a Game' : undefined}
          onAction={filter === 'all' ? () => navigate(PATHS.home) : undefined}
        />
      ) : null}

      {list.status === 'ready' && list.items.length > 0 ? (
        <div className="flex w-full flex-col gap-3">
          <ul aria-label="Your games" className="flex w-full flex-col gap-3">
            {list.items.map((item, index) => (
              <HistoryRow key={item.id} item={item} linkRef={refFor(index)} />
            ))}
          </ul>

          {/* A failed extra page leaves the list where it is. */}
          {list.error ? <Banner variant="error">{list.error}</Banner> : null}

          {list.hasMore ? (
            <LoadMoreButton
              label="Load more games"
              loading={list.loadingMore}
              onPress={loadMore}
            />
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
