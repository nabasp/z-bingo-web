import { useIsSpeaking } from '../hooks/useIsSpeaking';
import { useMicState } from '../hooks/useMicState';

/**
 * Expanding rings beside a player who is talking.
 *
 * Two rings on the same animation offset by half its duration, so the effect
 * reads as a continuous ripple rather than a pulse. Sized in `em` so it scales
 * with whatever text it sits next to.
 *
 * Deliberately **decorative and nothing more**. It is `aria-hidden`, and the
 * player's microphone state is already stated in words by `StatusBadge` — this
 * never becomes the only way to know something, which is the rule the rest of
 * the app follows. It also disappears entirely under `prefers-reduced-motion`
 * rather than degrading to a static dot, because a permanently-visible ring
 * next to a name would read as a status it is not.
 */
export function SpeakingRipple({ playerId }: { playerId: string }) {
  const speaking = useIsSpeaking(playerId);
  // A muted mic cannot produce sound, so a ripple there would be a lie —
  // guard against LiveKit's speaker detection lagging a mute by a frame.
  const live = useMicState(playerId) === 'mic-on';

  if (!speaking || !live) return null;

  return (
    <span aria-hidden="true" className="voice-ripple">
      <span className="voice-ripple__ring" />
      <span className="voice-ripple__ring voice-ripple__ring--delayed" />
      <span className="voice-ripple__core" />
    </span>
  );
}
