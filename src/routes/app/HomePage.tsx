import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Banner, PageHeading, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { useAuth } from '@/features/auth/context';
import { useGameSocket } from '@/features/game/context';
import { ActionCard } from '@/features/game/components';
import {
  EmptyState,
  ErrorState,
  HistoryRow,
  LeaderboardRow,
  LoadingState,
  historyApi,
  useRequest,
} from '@/features/history';
import { PATHS } from '../paths';

/** How many of each Home shows before "View all". */
const PREVIEW_COUNT = 3;

/**
 * A "view all" link, styled as a quiet button.
 *
 * A link, not a button: it goes somewhere, so it should open in a new tab on a
 * middle-click and announce itself as a link. The arrow is decoration.
 */
function ViewAllLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

export function HomePage() {
  const { user } = useAuth();
  // Home is where the route guard lands a player whose room ended without
  // them, so it is where the explanation has to be shown.
  const { notice, clearNotice } = useGameSocket();

  // Fetched on every visit: arriving here remounts the page, so a game that
  // has just ended is always in the list without any refresh logic.
  const fetchRecent = useCallback(
    async () => (await historyApi.games({ limit: PREVIEW_COUNT })).games,
    [],
  );
  const recent = useRequest('recent', fetchRecent);

  const fetchTop = useCallback(
    async () => (await historyApi.leaderboard({ limit: PREVIEW_COUNT })).players,
    [],
  );
  const top = useRequest('top', fetchTop);

  const headingRef = useAnnounceOnFocus({
    title: 'Home',
    // Names every way in. It listed two of the three before the bot mode
    // existed, which left the others to be found by exploring.
    detail:
      'Create a room to host a game, join one with a code, invite friends, or play against the bot.',
  });

  const firstName = (user?.fullName || '').trim().split(/\s+/)[0];

  return (
    <PageShell>
      <PageHeading
        headingRef={headingRef}
        title={firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
        subtitle="Ready to play?"
      />

      {notice ? (
        <Banner variant="info" onDismiss={clearNotice}>
          {notice.message}
        </Banner>
      ) : null}

      <div className="flex w-full flex-col gap-4">
        <ActionCard
          title="Create Room"
          subtitle="Host a new game"
          glyph="+"
          variant="primary"
          to={PATHS.createRoom}
        />
        <ActionCard
          title="Play with Friends"
          subtitle="Invite friends to a game"
          glyph="♦"
          to={PATHS.playWithFriends}
        />
        <ActionCard
          title="Join Room"
          subtitle="Enter a room code"
          glyph="→"
          to={PATHS.joinRoom}
        />
        {/* No room, no code, no waiting — straight into a game. */}
        <ActionCard
          title="Play with Bot"
          subtitle="A single-player game against the computer"
          glyph="🤖"
          to={PATHS.bot}
        />
      </div>

      <section aria-labelledby="recent-games-heading" className="flex w-full flex-col gap-3">
        <h2
          id="recent-games-heading"
          className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Recent Games
        </h2>

        {recent.status === 'loading' ? <LoadingState label="Loading your recent games" /> : null}

        {recent.status === 'error' && recent.error ? (
          <ErrorState message={recent.error} onRetry={recent.reload} />
        ) : null}

        {recent.status === 'ready' && recent.data?.length === 0 ? (
          // No button: every way to start a game is directly above.
          <EmptyState
            title="No games yet"
            body="Join a bingo game to start building your game history."
          />
        ) : null}

        {recent.status === 'ready' && recent.data && recent.data.length > 0 ? (
          <>
            <ul aria-label="Recent games" className="flex w-full flex-col gap-3">
              {recent.data.map(item => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </ul>
            <ViewAllLink to={PATHS.history}>View all games</ViewAllLink>
          </>
        ) : null}
      </section>

      <section aria-labelledby="top-players-home-heading" className="flex w-full flex-col gap-3">
        <h2
          id="top-players-home-heading"
          className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Top Players
        </h2>

        {top.status === 'loading' ? <LoadingState label="Loading the top players" /> : null}

        {top.status === 'error' && top.error ? (
          <ErrorState message={top.error} onRetry={top.reload} />
        ) : null}

        {top.status === 'ready' && top.data?.length === 0 ? (
          <EmptyState
            title="No rankings yet"
            body="Play some games to appear on the leaderboard."
          />
        ) : null}

        {top.status === 'ready' && top.data && top.data.length > 0 ? (
          <ul aria-label="Top players" className="flex w-full flex-col gap-3">
            {top.data.map((entry, index) => (
              <LeaderboardRow key={index} entry={entry} />
            ))}
          </ul>
        ) : null}

        {/* Offered even with no rankings: it is also where your own standing
            lives. */}
        {top.status === 'ready' ? (
          <ViewAllLink to={PATHS.leaderboard}>View leaderboard</ViewAllLink>
        ) : null}
      </section>
    </PageShell>
  );
}
