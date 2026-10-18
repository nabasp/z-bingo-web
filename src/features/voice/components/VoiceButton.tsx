import { Button } from '@/components/ui';
import { announcer, sentence } from '@/lib/a11y';
import { useOptionalVoice } from '../context/useVoice';
import { VOICE_LABEL, VOICE_WHY } from '../voiceLabels';

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
  // Null in a bot game, which mounts no voice provider — there is nobody to
  // talk to, so there is no control to offer.
  const voice = useOptionalVoice();
  if (!voice) return null;
  const { connection, micOn, toggleMic, retry } = voice;

  const live = connection === 'live';
  const label = live ? (micOn ? 'Mic On' : 'Mic Off') : VOICE_LABEL[connection];

  const press = () => {
    if (live) {
      toggleMic();
      return;
    }
    const why = VOICE_WHY[connection];
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
          : sentence(VOICE_LABEL[connection], 'Activate to try again')
      }>
      {label}
    </Button>
  );
}
