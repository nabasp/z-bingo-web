import { Banner, PageHeading, PageShell, SectionLabel, TextLink } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { useAuth } from '@/features/auth/context';
import { useGameSocket } from '@/features/game/context';
import { ActionCard, RecentGameTile } from '@/features/game/components';
import { mockRecentGames } from '@/features/game/mock';
import { PATHS } from '../paths';

/**
 * Match history has no backend yet.
 *
 * Flipping this on renders the mock fixtures for design work; off, the section
 * shows an honest empty state instead of presenting invented data as real. Same
 * switch, same default as the mobile `HomeScreen`.
 */
const SHOW_MOCK_DATA = false;

export function HomePage() {
  const { user, logout } = useAuth();
  // Home is where the route guard lands a player whose room ended without
  // them, so it is where the explanation has to be shown.
  const { notice, clearNotice } = useGameSocket();
  const recentGames = SHOW_MOCK_DATA ? mockRecentGames : [];

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

      <section className="flex w-full flex-col gap-3">
        <SectionLabel>Recent Games</SectionLabel>
        {recentGames.length > 0 ? (
          <div className="flex w-full gap-3">
            {recentGames.map(game => (
              <RecentGameTile key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No games yet. Create or join a room to get started.
          </p>
        )}
      </section>

      <div className="flex w-full justify-center pt-2">
        <TextLink label="Log out" onClick={() => void logout()} />
      </div>
    </PageShell>
  );
}
