/**
 * Thrown when the user dismisses a provider sign-in popup without completing
 * sign-in. Callers treat this as a no-op rather than an error banner.
 *
 * Mirrors `bingo/src/features/auth/services/oauthErrors.ts`; on the web the
 * cancellation arrives as a Firebase `auth/popup-closed-by-user` (or
 * `auth/cancelled-popup-request`) code rather than a native SDK status.
 */
export class OAuthCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'OAuthCancelledError';
  }
}

/** Firebase codes that mean "the user backed out", not "something broke". */
const CANCELLED_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

export function isOAuthCancelled(error: unknown): boolean {
  if (error instanceof OAuthCancelledError) return true;
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' && CANCELLED_CODES.has(code);
  }
  return false;
}

/**
 * Dev-only structured log for a provider failure. Logs a whitelist of safe
 * fields — never tokens or full payloads — so the real cause is visible in the
 * console while the UI still shows a friendly message.
 */
export function logOAuthError(context: string, error: unknown): void {
  if (!import.meta.env.DEV) return;
  const e = (error ?? {}) as Record<string, unknown>;
  console.warn(`[oauth] ${context} failed:`, {
    name: e.name,
    code: e.code,
    message: e.message ?? String(error),
  });
}
