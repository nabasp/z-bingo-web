import { useCallback, useState, type ReactNode } from 'react';
import { audioManager } from '@/lib/audio/AudioManager';
import { LoadingScreen } from './LoadingScreen';
import { useAppPreload } from './useAppPreload';

export interface AppLoadingGateProps {
  children: ReactNode;
}

/**
 * Holds every screen back until the game's sounds are in memory.
 *
 * Wrapped around the router rather than around the whole tree on purpose: the
 * providers underneath keep mounting while this waits, so authentication, the
 * socket and the preload all resolve in parallel rather than one after the
 * other.
 *
 * **The trade this makes.** `AudioManager.preload` used to leave the clips
 * unfetched precisely so a visitor who only wanted to sign in did not pay for
 * 6.2 MB of audio. Gating at page load reverses that: the bytes are now paid
 * for up front, once, in exchange for a first cue that is never late. Repeat
 * visits are served from the browser cache, where `canplaythrough` settles
 * immediately and this screen is a single frame.
 */
export function AppLoadingGate({ children }: AppLoadingGateProps) {
  const { state, retry } = useAppPreload();
  const [started, setStarted] = useState(false);

  const start = useCallback(() => {
    // The press is the user gesture browsers require before any audio may
    // play. Doing it here means the first in-game cue is not the one that
    // discovers the page was never unlocked.
    audioManager.unlock();
    setStarted(true);
  }, []);

  if (started) return <>{children}</>;

  return <LoadingScreen state={state} onRetry={retry} onStart={start} />;
}
