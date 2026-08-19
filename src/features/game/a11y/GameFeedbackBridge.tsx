import { useGameFeedback } from '../hooks/useGameFeedback';

/**
 * Renders nothing; exists so `useGameFeedback` has exactly one mount point for
 * the whole session.
 *
 * Mounted by the app root as a child of `GameSocketProvider` rather than from
 * inside the provider — that keeps the provider what its header says it is
 * (pure state, no side effects) and avoids a provider-to-hook import cycle.
 */
export function GameFeedbackBridge(): null {
  useGameFeedback();
  return null;
}
