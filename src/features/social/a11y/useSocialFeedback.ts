import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { announcer } from '@/lib/a11y/Announcer';
import { PATHS } from '@/routes/paths';
import { useSocial } from '../context';
import { deriveSocialSpeechEvents, type SocialState } from './socialSpeechEvents';

/**
 * Speaks social changes, once for the whole session.
 *
 * Mirrors `useGameFeedback`: hold the previous state, diff it against the new
 * one, and hand the result to the shared `announcer` — which does the
 * coalescing, pacing and deduplication, so several changes landing together
 * become one utterance rather than four that talk over each other.
 */
export function useSocialFeedback(): void {
  const { friends, requests, incomingInvite } = useSocial();
  const { pathname } = useLocation();
  const previous = useRef<SocialState | null>(null);

  useEffect(() => {
    const next: SocialState = { friends, requests, incomingInvite };
    const events = deriveSocialSpeechEvents(previous.current, next, {
      onFriendsScreen: pathname === PATHS.friends,
    });
    previous.current = next;

    for (const event of events) {
      announcer.speak(event.text, {
        priority: event.priority,
        assertive: event.assertive,
        dedupeKey: event.dedupeKey,
      });
    }
  }, [friends, requests, incomingInvite, pathname]);
}
