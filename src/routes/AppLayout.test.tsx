import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = [...nav.querySelectorAll('a')].map(a => a.textContent?.trim());
    expect(links).toContain('Home');
    expect(links).toContain('Friends');
    expect(links).toContain('Profile');
  });

  it('points Friends at the friends route', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Friends' })).toHaveAttribute(
      'href',
      '/friends',
    );
  });

  it('hides the whole bar on the game board', () => {
    // The board should own the viewport, matching the mobile game screen
    // pushing over the tabs. Friends is unreachable there by design.
    renderAt('/game/play');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});
