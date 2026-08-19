import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/features/auth/context';
import { useGameSocket } from '@/features/game/context';
import { PATHS } from './paths';

/** Splash shown while the persisted Firebase session is being restored. */
function Restoring() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner size="lg" label="Loading your session" className="text-primary" />
    </div>
  );
}

/**
 * Protected routes.
 *
 * This is the web form of the mobile `RootNavigator`, which mounts exactly one
 * of the two route groups based on auth state. `restoring` is a real third
 * state, not a loading detail: redirecting before Firebase has answered would
 * bounce every returning player to the sign-in page on each refresh.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'restoring') return <Restoring />;
  if (status === 'unauthenticated') {
    // Remember where they were headed, so sign-in can return them there.
    return <Navigate to={PATHS.signIn} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** The inverse: keep a signed-in player off the sign-in and sign-up pages. */
export function RequireGuest() {
  const { status } = useAuth();

  if (status === 'restoring') return <Restoring />;
  if (status === 'authenticated') return <Navigate to={PATHS.home} replace />;
  return <Outlet />;
}

/**
 * Guards the live game pages.
 *
 * `/game/lobby` and everything after it only mean anything while the server has
 * you in a room. Typing one of those URLs directly, or refreshing after leaving,
 * would otherwise render a page with no room to describe. The mobile app gets
 * this for free — you cannot deep-link into the middle of a native stack.
 *
 * The socket needs a moment to connect and `sync` before we can know, so this
 * waits on `synced` rather than redirecting on a not-yet-answered question.
 * Keying off `connection` alone is not enough: the socket reports connected the
 * instant the transport opens, a beat before the `sync` ack lands, and in that
 * window a refresh mid-match would bounce the player home out of a live game.
 */
export function RequireRoom() {
  const { room, synced } = useGameSocket();

  if (room) return <Outlet />;
  if (!synced) return <Restoring />;
  return <Navigate to={PATHS.home} replace />;
}
