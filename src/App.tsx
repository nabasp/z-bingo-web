import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import {
  audioManager,
  connectAudioToAccessibility,
  loadHapticsPreference,
  loadNotationPreference,
  loadSelfVoicePreference,
} from '@/lib';
import { AuthProvider } from '@/features/auth/context';
import { GameFeedbackBridge } from '@/features/game/a11y';
import { GameSocketProvider } from '@/features/game/context';
import { AppLoadingGate } from '@/features/loading';
import { SocialProvider } from '@/features/social';
import { router } from '@/routes/router';

/**
 * Start the audio and feedback subsystems once, at launch.
 *
 * Clips are created here and fetched by `AppLoadingGate`, which holds every
 * screen back until they can play through — an in-game cue is then a `play()`
 * call rather than a network round trip. Playback stays blocked until the
 * first user gesture (see `AudioManager.unlock`, wired both in `main.tsx` and
 * to the loading screen's Start button), and everything is stopped when the
 * tab is hidden so a cue never plays over whatever the player switched to —
 * the web equivalent of the mobile `AppState` listener.
 */
function useAudioLifecycle() {
  useEffect(() => {
    const disconnect = connectAudioToAccessibility();
    loadHapticsPreference();
    loadNotationPreference();
    loadSelfVoicePreference();
    audioManager.preload();

    const onVisibilityChange = () => {
      if (document.hidden) audioManager.stopAll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      disconnect();
      /*
        `audioManager.release()` is deliberately NOT called here.

        It is a page-lifetime singleton, and disposing it from a component
        effect means React's development double-mount tears the clips down
        mid-download and fetches all 28 a second time — the exact duplicate
        work the preloading exists to avoid. In a browser the cleanup bought
        nothing anyway: the only thing that unmounts `App` is the page going
        away, which frees everything regardless. `release()` stays public for
        tests, which do need a clean slate between cases.
      */
    };
  }, []);
}

export default function App() {
  useAudioLifecycle();

  return (
    <AuthProvider>
      {/* Socket connects once authenticated; owns all live room state. */}
      <GameSocketProvider>
        {/* Friends, presence and invitations, on that same socket. */}
        <SocialProvider>
          {/* Turns room-snapshot changes into sound, speech and haptics. */}
          <GameFeedbackBridge />
          {/*
            `SocialFeedbackBridge` is NOT here: it reads the current route to
            decide whether presence changes are worth announcing, so it has to
            sit inside the router. It is mounted in `AppLayout` instead.
          */}
          {/*
            Nothing is shown until the game's sounds are in memory. The
            providers above keep mounting behind it, so auth and the socket
            resolve while the clips download rather than after.
          */}
          <AppLoadingGate>
            <RouterProvider router={router} />
          </AppLoadingGate>
        </SocialProvider>
      </GameSocketProvider>
    </AuthProvider>
  );
}
