/**
 * Ported verbatim from the React Native app:
 * `bingo/src/features/auth/utils/emailVerification.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import type { User } from '@/types';

/**
 * Whether this account is being held at the verification gate.
 *
 * Two conditions, and both matter. `emailVerified` is the question being asked;
 * `hasPasswordProvider` is what keeps the gate from becoming a trap. A Google
 * or Apple account has already proved its address to its provider — and has no
 * password to reset — so demanding a confirmation email it can never act on
 * would lock the account out permanently.
 */
export function needsEmailVerification(user: User | null): boolean {
  if (!user) return false;
  return user.hasPasswordProvider && !user.emailVerified;
}

/**
 * How long to disable the resend button after a send, in milliseconds.
 *
 * Firebase rate-limits verification mail per account and answers an impatient
 * user with `auth/too-many-requests` — which reads as a failure even though the
 * first mail is on its way. A visible countdown says the same thing honestly.
 */
export const RESEND_COOLDOWN_MS = 60_000;

/** Seconds still left on the cooldown, floored at 0. */
export function cooldownSecondsLeft(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null) return 0;
  const remaining = RESEND_COOLDOWN_MS - (now - lastSentAt);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
