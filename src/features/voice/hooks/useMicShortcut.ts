import { announcer, sentence, SHORTCUTS, useShortcut } from '@/lib/a11y';
import { useVoice } from '../context/useVoice';
import { VOICE_LABEL, VOICE_WHY } from '../voiceLabels';

/**
 * Alt+M: mute or unmute, from anywhere in the game.
 *
 * Unlike the button, this one always speaks. The button can stay silent because
 * pressing it means it was focused, and a screen reader re-reads a focused
 * control's `aria-pressed` after the change — but nothing announces a control
 * you never touched. Without speech the shortcut would be a key that gives no
 * sign of having worked, which for a mute toggle is the worst possible outcome.
 *
 * Not assertive: muting is not urgent, and interrupting would discard whatever
 * the announcer is part-way through saying about the turn.
 */
export function useMicShortcut(): void {
  const { connection, micOn, toggleMic } = useVoice();

  useShortcut(SHORTCUTS.toggleMic.chord, () => {
    if (connection === 'live') {
      // `micOn` here is the value before the toggle, and `toggleMic` updates
      // optimistically — so the state being announced is the one after.
      const next = !micOn;
      toggleMic();
      announcer.speak(next ? 'Microphone on' : 'Microphone muted', {
        dedupeKey: 'voice-status',
      });
      return;
    }

    // Outside a room, or while connecting, there is nothing to toggle. Say the
    // state rather than retrying silently, so the key is never simply dead.
    announcer.speak(
      sentence(VOICE_LABEL[connection], VOICE_WHY[connection] ?? 'Voice chat is not available.'),
      { assertive: true, dedupeKey: 'voice-status' },
    );
  });
}
