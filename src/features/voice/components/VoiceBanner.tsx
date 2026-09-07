import { Banner } from '@/components/ui';
import { useVoice } from '../context/useVoice';

/**
 * Whatever voice chat currently needs to tell the player, or nothing.
 *
 * Sits alongside `ConnectionBanner`, and deliberately uses the `info` variant
 * rather than `error`: none of these states stop the game, and dressing a
 * missing microphone up as an error would misrepresent what has happened. The
 * announcer has already spoken the same sentence; this is its visible half.
 */
export function VoiceBanner() {
  const { message } = useVoice();
  if (!message) return null;
  return <Banner variant="info">{message}</Banner>;
}
