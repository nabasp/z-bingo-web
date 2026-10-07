import { Link, NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { AppLogo } from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import { PlayerAvatar } from '@/features/game/components';
import { HelpButton } from '@/features/guide/HelpButton';
import { FOCUS_RING, NAV_ITEMS } from './navItems';
import { PATHS } from './paths';

/**
 * The top bar of the authenticated shell.
 *
 * **From `md` (768px) up** it carries the navigation: the links, Help and the
 * profile avatar in one row.
 *
 * **Below `md`** it is just the brand and Help. The links move to
 * `BottomNav`, a tab bar at the foot of the screen like the mobile app's —
 * within thumb reach, and with room for all four destinations at 320px, which
 * a single top row never had.
 *
 * Only one "Main" navigation landmark exists at any width: the one not in use
 * is `display: none`, which removes it from the accessibility tree and the Tab
 * order alike.
 *
 * Every target is at least 44px (WCAG 2.5.5 / Apple HIG). Not only on phones:
 * an iPad in portrait is exactly 768px wide, so "wide" is not "has a mouse".
 */
export function MainNav() {
  const { user } = useAuth();
  const name = user?.fullName || user?.email || 'Player';

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 md:px-6 md:py-3">
        <Link
          to={PATHS.home}
          className={cn('flex min-h-11 items-center gap-2 rounded-xl', FOCUS_RING)}>
          <AppLogo size="sm" />
          <span className="text-xl font-bold text-foreground">bingo</span>
        </Link>

        {/* Phone: Help stays up here; everything else is in the tab bar. */}
        <HelpButton className="h-11 w-11 text-base md:hidden" />

        <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
          <ul className="flex items-center gap-2">
            {NAV_ITEMS.map(item => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-card text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                      FOCUS_RING,
                    )
                  }>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <HelpButton className="h-11 w-11 text-base" />
          {/* A plain Link: the "Profile" item just before it already shows
              when you are on that page. */}
          <Link
            to={PATHS.profile}
            aria-label="Open profile"
            className={cn('flex h-11 w-11 items-center justify-center rounded-full', FOCUS_RING)}>
            <PlayerAvatar name={name} seatIndex={0} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
