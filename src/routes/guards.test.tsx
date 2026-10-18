import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PATHS } from './paths';

/**
 * The email-confirmation gate.
 *
 * A hard gate has two failure modes and they are not equally forgiving. Letting
 * an unconfirmed account through defeats the point; holding one that can never
 * satisfy the gate — a Google account, which has no confirmation mail to open —
 * locks a real player out of their own account with no self-service way back.
 * Both directions are asserted here, along with the redirect loop that a
 * carelessly nested route would produce.
 */

const authState = {
  status: 'authenticated' as 'authenticated' | 'unauthenticated' | 'restoring',
  needsEmailVerification: false,
};

vi.mock('@/features/auth/context', () => ({
  useAuth: () => authState,
}));

vi.mock('@/features/game/context', () => ({
  useGameSocket: () => ({ room: null, synced: true }),
}));

const { RequireAuth, RequireGuest, RequireUnverified } = await import('./guards');

afterEach(cleanup);

/** The whole gated tree in miniature, with the same nesting as `router.tsx`. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path={PATHS.signIn} element={<p>sign in</p>} />
        </Route>
        <Route element={<RequireUnverified />}>
          <Route path={PATHS.verifyEmail} element={<p>confirm your email</p>} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path={PATHS.home} element={<p>home</p>} />
          <Route path={PATHS.play} element={<p>game board</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth with an unconfirmed address', () => {
  it('holds the player at the confirmation page instead of home', () => {
    authState.status = 'authenticated';
    authState.needsEmailVerification = true;

    renderAt(PATHS.home);
    expect(screen.getByText('confirm your email')).toBeInTheDocument();
  });

  it('covers a deep link straight into a game, not just home', () => {
    authState.status = 'authenticated';
    authState.needsEmailVerification = true;

    renderAt(PATHS.play);
    expect(screen.getByText('confirm your email')).toBeInTheDocument();
  });

  it('lets a confirmed account through', () => {
    authState.status = 'authenticated';
    authState.needsEmailVerification = false;

    renderAt(PATHS.home);
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});

describe('RequireUnverified', () => {
  it('sends a confirmed account back to the app, which is how the gate ends', () => {
    authState.status = 'authenticated';
    authState.needsEmailVerification = false;

    renderAt(PATHS.verifyEmail);
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign-in rather than a gate with no session', () => {
    authState.status = 'unauthenticated';
    authState.needsEmailVerification = false;

    renderAt(PATHS.verifyEmail);
    expect(screen.getByText('sign in')).toBeInTheDocument();
  });
});

describe('RequireGuest', () => {
  it('lands the confirmation mail’s continue URL on the gate, not a bounce via home', () => {
    // The mail sends the user to /signin, and that session is still signed in.
    authState.status = 'authenticated';
    authState.needsEmailVerification = true;

    renderAt(PATHS.signIn);
    expect(screen.getByText('confirm your email')).toBeInTheDocument();
  });

  it('still sends a confirmed signed-in player home', () => {
    authState.status = 'authenticated';
    authState.needsEmailVerification = false;

    renderAt(PATHS.signIn);
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
