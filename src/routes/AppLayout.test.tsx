import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PATHS } from './paths';

/**
 * The authenticated shell's navigation.
 *
 * Whether a destination is actually reachable is not something a route table
 * proves — a page can be registered and still have no way in. This asserts the
 * links a signed-in player can see.
 */

vi.mock('@/features/auth/context', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u1', fullName: 'Ann Lee', email: 'ann@example.com' },
  }),
}));

vi.mock('@/features/social', () => ({
  SocialFeedbackBridge: () => null,
}));

vi.mock('@/features/social/components/InviteListener', () => ({
  InviteListener: () => null,
}));

const { AppLayout } = await import('./AppLayout');

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppLayout />
    </MemoryRouter>,
  );
}

describe('AppLayout navigation', () => {
  it('offers Home, Friends and Profile', () => {
    renderAt('/');

    // Two "Main" navs exist in the DOM — the wide-screen top bar and the phone
    // tab bar — and CSS shows exactly one. jsdom has no CSS, so it sees both,
    // and each must offer every destination.
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      const links = [...nav.querySelectorAll('a')].map(a => a.textContent?.trim());
      expect(links).toContain('Home');
      expect(links).toContain('Friends');
      expect(links).toContain('Profile');
    }
  });

  it('points Friends at the friends route', () => {
    renderAt('/');
    for (const link of screen.getAllByRole('link', { name: 'Friends' })) {
      expect(link).toHaveAttribute('href', '/friends');
    }
  });

  it('hides the whole bar on the game board', () => {
    // The board should own the viewport, matching the mobile game screen
    // pushing over the tabs. Friends is unreachable there by design.
    renderAt('/game/play');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});

/**
 * The phone tab bar is the `fixed` "Main" nav; the top bar's is not. jsdom
 * applies no CSS, so it is told apart by that rather than by visibility.
 */
function tabBar(): HTMLElement | undefined {
  return screen
    .queryAllByRole('navigation', { name: 'Main' })
    .find(nav => nav.classList.contains('fixed'));
}

/** Every route in the game flow, read from PATHS so none can be missed. */
const GAME_FLOW = Object.values(PATHS).filter(
  path => path.startsWith('/game/') || path === PATHS.bot || path.startsWith(`${PATHS.bot}/`),
);

describe('AppLayout tab bar in the game flow', () => {
  it('covers every screen of both game modes', () => {
    // A guard on the guard: if this list shrinks, a game screen has started
    // showing tabs again.
    expect(GAME_FLOW).toEqual(
      expect.arrayContaining([
        PATHS.createRoom,
        PATHS.joinRoom,
        PATHS.lobby,
        PATHS.boardSetup,
        PATHS.waiting,
        PATHS.play,
        PATHS.result,
        PATHS.bot,
        PATHS.botBoardSetup,
        PATHS.botPlay,
        PATHS.botResult,
      ]),
    );
  });

  it.each(GAME_FLOW)('hides the tab bar on %s, as the mobile app pushes games over its tabs', path => {
    renderAt(path);
    expect(tabBar()).toBeUndefined();
    // And leaves no empty space at the foot of the page where it would be.
    expect(document.getElementById('main')?.className).not.toMatch(/safe-area-inset-bottom/);
    cleanup();
  });

  it('keeps the top bar on game screens other than the board', () => {
    renderAt(PATHS.boardSetup);
    expect(screen.getByRole('link', { name: 'bingo' })).toBeInTheDocument();
  });

  it.each([PATHS.home, PATHS.leaderboard, PATHS.friends, PATHS.profile, PATHS.history])(
    'shows the tab bar on %s, and clears space for it',
    path => {
      renderAt(path);
      expect(tabBar()).toBeDefined();
      expect(document.getElementById('main')?.className).toMatch(/safe-area-inset-bottom/);
      cleanup();
    },
  );
});
