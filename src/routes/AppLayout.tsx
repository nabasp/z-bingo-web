import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { AppLogo } from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import { PlayerAvatar } from '@/features/game/components';
import { SocialFeedbackBridge } from '@/features/social';
import { InviteListener } from '@/features/social/components/InviteListener';
import { HelpButton } from '@/features/guide/HelpButton';
import { PATHS } from './paths';

const NAV_ITEMS = [
  { to: PATHS.home, label: 'Home' },
  { to: PATHS.leaderboard, label: 'Leaderboard' },
  { to: PATHS.friends, label: 'Friends' },
  { to: PATHS.profile, label: 'Profile' },
];

/**
 * The authenticated shell.
 *
 * The mobile app puts Home and Profile in a bottom tab bar; on the web a
 * persistent top bar is the equivalent convention and leaves the vertical space
 * to the content. It hides on the game board, where the board should own the
 * viewport — the same reason the mobile game screen pushes over the tabs.
 */

/**
 * Pages that hide the top nav: both boards, multiplayer and bot alike. The grid
 * wants the width, and the nav is one more thing to Tab past on the way to it.
 */
const BOARD_PATHS = new Set<string>([PATHS.play, PATHS.botPlay]);

export function AppLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const hideNav = BOARD_PATHS.has(pathname);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Lets a keyboard user skip the nav on every page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>

      {!hideNav ? (
        <header className="border-b border-border bg-background/95 backdrop-blur">
          <nav
            aria-label="Main"
            className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link to={PATHS.home} className="flex items-center gap-2">
              <AppLogo size="sm" />
              <span className="text-xl font-bold text-foreground">bingo</span>
            </Link>

            <div className="flex items-center gap-1 sm:gap-2">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-card text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }>
                  {item.label}
                </NavLink>
              ))}
              <HelpButton className="ml-1 h-9 w-9 text-base" />
              <Link
                to={PATHS.profile}
                aria-label="Open profile"
                className="ml-1 rounded-full">
                <PlayerAvatar name={user?.fullName || user?.email || 'Player'} seatIndex={0} />
              </Link>
            </div>
          </nav>
        </header>
      ) : null}

      <main id="main" className="flex flex-1 flex-col">
        <Outlet />
      </main>

      {/*
        Both are mounted for every authenticated route, and both need to be
        inside the router: the bridge reads the current route to decide whether
        a presence change is worth announcing, and accepting an invitation
        navigates into the lobby.
      */}
      <SocialFeedbackBridge />
      <InviteListener />
    </div>
  );
}
