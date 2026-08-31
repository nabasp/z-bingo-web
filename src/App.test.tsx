import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The app boots.
 *
 * This exists because of a real bug it would have caught: `SocialFeedbackBridge`
 * reads the current route, and was mounted *outside* `RouterProvider`. Every
 * component test passed — each one renders its subject inside a router — while
 * the actual application was a blank screen, because the bridge threw during
 * render and took the whole tree with it.
 *
 * The lesson generalises: a suite that only ever renders pieces cannot see a
 * wiring mistake in how those pieces are assembled. So this renders the real
 * `App`, with only the network boundaries faked.
 */

// Firebase would try to reach the network on import.
vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({
    currentUser: null,
    onAuthStateChanged: (cb: (user: null) => void) => {
      cb(null);
      return () => {};
    },
  }),
}));

// The socket must not dial out from a test.
vi.mock('@/lib/socketClient', () => ({
  createGameSocket: () => ({
    on: () => {},
    off: () => {},
    emit: () => {},
    connect: () => {},
    close: () => {},
    removeAllListeners: () => {},
    connected: false,
  }),
}));

const App = (await import('./App')).default;

afterEach(cleanup);

describe('App', () => {
  it('renders without crashing, and lands on sign-in when signed out', async () => {
    render(<App />);

    // Reaching any real content proves the whole provider stack — auth, game
    // socket, social, feedback bridges and the router — composed without
    // throwing.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument(),
    );
  });

  it('mounts the feedback bridges inside the router', async () => {
    // A bridge that reads the route from outside `RouterProvider` throws on
    // the very first render, so an app that renders at all has them nested
    // correctly. Asserting no error was logged makes the intent explicit.
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());

    const routerComplaints = onError.mock.calls
      .flat()
      .filter(arg => String(arg).includes('useLocation'));
    expect(routerComplaints).toEqual([]);
    onError.mockRestore();
  });
});
