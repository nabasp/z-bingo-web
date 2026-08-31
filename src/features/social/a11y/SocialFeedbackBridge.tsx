import { useSocialFeedback } from './useSocialFeedback';

/**
 * Renders nothing; gives `useSocialFeedback` exactly one mount point.
 *
 * Mounted beside `GameFeedbackBridge` rather than inside `SocialProvider`, for
 * the same reason: it keeps the provider pure state and avoids a
 * provider-to-hook import cycle.
 */
export function SocialFeedbackBridge(): null {
  useSocialFeedback();
  return null;
}
