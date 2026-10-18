import type { ReactNode } from 'react';
import { PATHS } from './paths';

/**
 * The app's top-level destinations, declared once.
 *
 * The desktop top bar and the phone tab bar both render from this list, so the
 * two can never offer different places to go.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

/** Shared by every icon: 24px, drawn in the current text colour. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6">
      {children}
    </svg>
  );
}

/**
 * Icons are decoration — `aria-hidden` — and every tab keeps its text label.
 * An icon on its own is a guess at what it means; the word is not.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: PATHS.home,
    label: 'Home',
    icon: (
      <Icon>
        <path d="M3 10.5 12 3.5l9 7V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </Icon>
    ),
  },
  {
    to: PATHS.leaderboard,
    label: 'Leaderboard',
    icon: (
      <Icon>
        <path d="M3 21h18M5 21v-7h4v7M10 21V9h4v12M15 21v-10h4v10" />
      </Icon>
    ),
  },
  {
    to: PATHS.friends,
    label: 'Friends',
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.3a5 5 0 0 1 5.5 4.7" />
      </Icon>
    ),
  },
  {
    to: PATHS.profile,
    label: 'Profile',
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </Icon>
    ),
  },
];

/** The visible focus ring every nav control shares. */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
