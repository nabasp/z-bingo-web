import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from './navItems';

/**
 * The phone tab bar, like the mobile app's.
 *
 * Fixed to the foot of the screen below `md` and gone above it, where the top
 * bar carries the same links. Four equal tabs, each an icon over a label and
 * at least 56px tall — comfortably past the 44px minimum, because this is the
 * one control a thumb reaches for most.
 *
 * **It comes after the page in the DOM**, so it is also last in the Tab order
 * — matching where it sits on screen, and matching the mobile app, where
 * TalkBack reaches the tab bar after the screen's content. The "Skip to
 * content" link and the navigation landmark are the quick ways to it.
 *
 * **The current tab is marked three ways**: `aria-current="page"` for screen
 * readers, and on screen a filled pill behind the icon plus a bolder label —
 * never colour alone (WCAG 1.4.1).
 *
 * `env(safe-area-inset-bottom)` keeps the tabs clear of the iPhone home
 * indicator when the app is installed to the home screen; elsewhere it is 0.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {NAV_ITEMS.map(item => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] leading-tight transition-colors',
                  isActive
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-muted-foreground hover:text-foreground',
                  // Not the shared FOCUS_RING: that offsets the outline
                  // outward, and two offsets in one class list fight over the
                  // same property. Inside the tab, because the bar is flush
                  // with the screen edge and an outward ring would be clipped.
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                )
              }>
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-card',
                    )}>
                    {item.icon}
                  </span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Space to leave at the foot of the page so the tab bar never covers the last
 * of its content: the bar's own height plus the safe-area inset.
 */
export const BOTTOM_NAV_CLEARANCE = 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0';
