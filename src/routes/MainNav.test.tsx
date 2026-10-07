import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BottomNav } from './BottomNav';
import { MainNav } from './MainNav';
import { NAV_ITEMS } from './navItems';

/**
 * The navigation's contract: a top bar on wide screens, a tab bar on phones.
 *
 * jsdom has no CSS, so it cannot say which one shows at 375px — that was
 * checked in a browser at 320, 375, 767, 768 and 1280. What it can pin is the
 * structure both layouts depend on: the same destinations in each, which page
 * each marks as current, and where each sits in the Tab order.
 */

vi.mock('@/features/auth/context', () => ({
  useAuth: () => ({ user: { fullName: 'Navas Example', email: 'n@example.com' } }),
}));

afterEach(cleanup);

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MainNav />
      <main>
        <button type="button">Something on the page</button>
      </main>
      <BottomNav />
    </MemoryRouter>,
  );
}

const DESTINATIONS = ['Home', 'Leaderboard', 'Friends', 'Profile'];

describe('MainNav and BottomNav', () => {
  it('offer the same destinations, from one shared list', () => {
    renderShell('/');
    const [top, bottom] = screen.getAllByRole('navigation', { name: 'Main' });
    for (const nav of [top, bottom]) {
      expect(within(nav).getAllByRole('link').map(a => a.textContent?.trim()).filter(Boolean))
        .toEqual(expect.arrayContaining(DESTINATIONS));
    }
    expect(NAV_ITEMS.map(item => item.label)).toEqual(DESTINATIONS);
  });

  it('marks the current page in both, so whichever is showing says where you are', () => {
    renderShell('/leaderboard');
    const current = screen
      .getAllByRole('link', { name: 'Leaderboard' })
      .map(link => link.getAttribute('aria-current'));
    expect(current).toEqual(['page', 'page']);
    for (const home of screen.getAllByRole('link', { name: 'Home' })) {
      expect(home).not.toHaveAttribute('aria-current');
    }
  });

  it('keeps Home current only on Home, not on every page beneath it', () => {
    renderShell('/history');
    for (const home of screen.getAllByRole('link', { name: 'Home' })) {
      expect(home).not.toHaveAttribute('aria-current');
    }
  });

  it('puts the tab bar after the page, where it sits on screen', () => {
    // Last in the Tab order, as it is last on screen — and as the mobile app's
    // tab bar is for TalkBack.
    renderShell('/');
    const page = screen.getByRole('button', { name: 'Something on the page' });
    const tabBar = screen.getAllByRole('navigation', { name: 'Main' })[1];
    expect(page.compareDocumentPosition(tabBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Help reachable on a phone, ahead of the page', () => {
    // The phone copy of Help lives outside the (hidden) top nav, before the
    // page, so it is not lost when the links move to the tab bar.
    renderShell('/');
    const [phoneHelp] = screen.getAllByRole('link', { name: /help/i });
    const page = screen.getByRole('button', { name: 'Something on the page' });
    expect(phoneHelp.closest('nav')).toBeNull();
    expect(phoneHelp.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('gives every tab a text label, with the icon hidden from assistive technology', () => {
    renderShell('/');
    const tabBar = screen.getAllByRole('navigation', { name: 'Main' })[1];
    for (const tab of within(tabBar).getAllByRole('link')) {
      expect(DESTINATIONS).toContain(tab.textContent?.trim());
      expect(tab.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
