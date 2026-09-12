import { useCallback } from 'react';
import { announcer, sentence, SHORTCUTS, useShortcut } from '@/lib/a11y';
import { useOptionalVoice } from '../context/useVoice';
import { VOICE_LABEL, VOICE_WHY } from '../voiceLabels';

/**
 * Mute or unmute, and say which it now is.
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
export function useMicToggleAction(): () => void {
  const voice = useOptionalVoice();
  const connection = voice?.connection ?? 'off';
  const micOn = voice?.micOn ?? false;
  const toggleMic = voice?.toggleMic;

  return useCallback(() => {
    // No provider at all: a bot game, where the key is not dead so much as
    // beside the point. Say so rather than let it look broken.
    if (!toggleMic) {
      announcer.speak('Voice chat is not part of a game against the bot.', {
        assertive: true,
        dedupeKey: 'voice-status',
      });
      return;
    }

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
  }, [connection, micOn, toggleMic]);
}

/**
 * Alt+M: mute or unmute, from anywhere in the game.
 *
 * The action is separate because the board binds a bare `M` to the same thing,
 * and a shortcut that does something subtly different from the key next to it
 * is worse than not having both.
 */
export function useMicShortcut(): void {
  useShortcut(SHORTCUTS.toggleMic.chord, useMicToggleAction());
}
