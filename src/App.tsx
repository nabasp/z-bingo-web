import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import {
  audioManager,
  connectAudioToAccessibility,
  loadHapticsPreference,
} from '@/lib';
import { AuthProvider } from '@/features/auth/context';
import { GameFeedbackBridge } from '@/features/game/a11y';
import { GameSocketProvider } from '@/features/game/context';
import { router } from '@/routes/router';

/**
 * Start the audio and feedback subsystems once, at launch.
 *
 * Clips are created and fetched up front so an in-game cue is a `play()` call
 * rather than a network round trip. Playback stays blocked until the first user
 * gesture (see `AudioManager.unlock`, wired in `main.tsx`), and everything is
 * stopped when the tab is hidden so a cue never plays over whatever the player
 * switched to — the web equivalent of the mobile `AppState` listener.
 */
function useAudioLifecycle() {
  useEffect(() => {
    const disconnect = connectAudioToAccessibility();
    loadHapticsPreference();
    audioManager.preload();

    const onVisibilityChange = () => {
      if (document.hidden) audioManager.stopAll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      disconnect();
      audioManager.release();
    };
  }, []);
}

export default function App() {
  useAudioLifecycle();

  return (
    <AuthProvider>
      {/* Socket connects once authenticated; owns all live room state. */}
      <GameSocketProvider>
        {/* Turns room-snapshot changes into sound, speech and haptics. */}
        <GameFeedbackBridge />
        <RouterProvider router={router} />
      </GameSocketProvider>
    </AuthProvider>
  );
}
