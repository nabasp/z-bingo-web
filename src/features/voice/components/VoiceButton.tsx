import { Button } from '@/components/ui';
import { announcer, sentence } from '@/lib/a11y';
import { useVoice } from '../context/useVoice';
import type { VoiceConnection } from '../context/voiceContext';

/**
 * What the button says in each state.
 *
 * The state is always carried in *words*, never by colour alone — the same
 * rule the connection and ready badges follow, and the reason a screen-reader
 * user and a sighted user learn the same thing from this control.
 */
const LABEL: Record<VoiceConnection, string> = {
  off: 'Voice Off',
  connecting: 'Voice Connecting',
  live: 'Mic On',
  reconnecting: 'Voice Reconnecting',
  denied: 'Mic Blocked',
  unavailable: 'Voice Unavailable',
};

/** Said when the button is pressed but cannot do what it normally does. */
const WHY: Partial<Record<VoiceConnection, string>> = {
  connecting: 'Voice chat is still connecting.',
  reconnecting: 'Voice chat is reconnecting. Please wait.',
};

/**
 * Mute toggle for the room's voice chat.
 *
 * Deliberately never `disabled`. A disabled control is unreachable by keyboard
 * and tells a screen-reader user nothing about why — so instead this always
 * accepts the press and answers: when the session is live it toggles the
 * microphone, and otherwise it retries the connection or explains what is
 * happening. That is the same choice the board makes for cells that cannot be
 * pressed yet.
 */
export function VoiceButton({ className }: { className?: string }) {
  const { connection, micOn, toggleMic, retry } = useVoice();

  const live = connection === 'live';
  const label = live ? (micOn ? 'Mic On' : 'Mic Off') : LABEL[connection];

  const press = () => {
    if (live) {
      toggleMic();
      return;
    }
    const why = WHY[connection];
    if (why) {
      announcer.speak(why, { assertive: true, dedupeKey: 'voice-status' });
      return;
    }
    // 'off', 'denied' and 'unavailable' are all retryable: the player is
    // asking for another go at whatever failed.
    retry();
  };

  return (
    <Button
      variant="outline"
      size="md"
      className={className}
      onClick={press}
      // Only meaningful while the microphone exists to be pressed; announcing
      // "not pressed" for an unavailable feature would be misleading.
      aria-pressed={live ? micOn : undefined}
      aria-label={
        live
          ? sentence(micOn ? 'Mic on' : 'Mic off', 'Voice chat', micOn ? 'Mute' : 'Unmute')
          : sentence(LABEL[connection], 'Activate to try again')
      }>
      {label}
    </Button>
  );
}
