import { Outlet, useLocation } from 'react-router-dom';
import { SocialFeedbackBridge } from '@/features/social';
import { InviteListener } from '@/features/social/components/InviteListener';
import { cn } from '@/lib/cn';
import { BOTTOM_NAV_CLEARANCE, BottomNav } from './BottomNav';
import { MainNav } from './MainNav';
import { PATHS } from './paths';

/**
 * The authenticated shell.
 *
 * Navigation follows the device: a top bar on wide screens, and on phones a
 * tab bar at the foot of the screen like the mobile app's (`BottomNav`). The
 * tab bar hides throughout the game flow and both hide on the board itself,
 * where the board should own the viewport — the same reasons the mobile app
 * pushes its game screens over the tabs.
 */

/**
 * Pages that hide all navigation: both boards, multiplayer and bot alike. The
 * grid wants the space, and the nav is one more thing to Tab past to reach it.
 */
const BOARD_PATHS = new Set<string>([PATHS.play, PATHS.botPlay]);

/**
 * The game flow: every screen from creating or joining a room to the result,
 * and the whole bot mode.
 *
 * The phone tab bar is hidden on all of them, matching the mobile app, where
 * the Game and Bot stacks are pushed *over* the tab bar. A game is something
 * you are in until you leave it through the game's own controls; tabs that
 * offered Leaderboard or Friends mid-match would invite walking out of a room
 * by accident, and they cost a lobby or board-setup screen vertical space it
 * needs. The top bar stays, with the brand and Help.
 *
 * Derived from `PATHS` rather than listed, so a game screen added later is
 * covered without anyone remembering to add it here.
 */
const GAME_FLOW_PATHS = new Set<string>(
  Object.values(PATHS).filter(
    path => path.startsWith('/game/') || path === PATHS.bot || path.startsWith(`${PATHS.bot}/`),
  ),
);

export function AppLayout() {
  const { pathname } = useLocation();
  const hideNav = BOARD_PATHS.has(pathname);
  const hideTabBar = hideNav || GAME_FLOW_PATHS.has(pathname);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Lets a keyboard user skip the nav on every page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>

      {!hideNav ? <MainNav /> : null}

      {/* Bottom padding on phones, so the fixed tab bar never sits over the
          last of the page — a Continue button, the end of a list. */}
      <main id="main" className={cn('flex flex-1 flex-col', !hideTabBar && BOTTOM_NAV_CLEARANCE)}>
        <Outlet />
      </main>

      {/* After the page, so it is last in the Tab order as it is on screen. */}
      {!hideTabBar ? <BottomNav /> : null}

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
