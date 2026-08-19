import { PageHeading, PageShell, SectionLabel, TextLink } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { useAuth } from '@/features/auth/context';
import { ActionCard, InviteCard, RecentGameTile } from '@/features/game/components';
import { mockInvitations, mockRecentGames } from '@/features/game/mock';
import { PATHS } from '../paths';

/**
 * Invitations and match history have no backend yet.
 *
 * Flipping this on renders the mock fixtures for design work; off, the sections
 * show honest empty states instead of presenting invented data as real. Same
 * switch, same default as the mobile `HomeScreen`.
 */
const SHOW_MOCK_DATA = false;

export function HomePage() {
  const { user, logout } = useAuth();
  const invitation = SHOW_MOCK_DATA ? mockInvitations[0] : undefined;
  const recentGames = SHOW_MOCK_DATA ? mockRecentGames : [];

  const headingRef = useAnnounceOnFocus({
    title: 'Home',
    detail: 'Create a room to host a game, or join one with a code.',
  });

  const firstName = (user?.fullName || '').trim().split(/\s+/)[0];

  return (
    <PageShell>
      <PageHeading
        headingRef={headingRef}
        title={firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
        subtitle="Ready to play?"
      />

      <div className="flex w-full flex-col gap-4">
        <ActionCard
          title="Create Room"
          subtitle="Host a new game"
          glyph="+"
          variant="primary"
          to={PATHS.createRoom}
        />
        <ActionCard
          title="Join Room"
          subtitle="Enter a room code"
          glyph="→"
          to={PATHS.joinRoom}
        />
      </div>

      {invitation ? (
        <section className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Invitations</SectionLabel>
            <span className="rounded-xl bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              1
            </span>
          </div>
          <InviteCard
            invitation={invitation}
            variant="compact"
            onJoin={() => undefined}
          />
        </section>
      ) : null}

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
