/**
 * Ported verbatim from the React Native app: `bingo/src/types/index.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

/**
 * Shared, app-wide domain types.
 *
 * Feature-specific types live under `src/features/<feature>/types`. Only put
 * types here when they are genuinely cross-cutting.
 */

/** A minimal authenticated user shape (mock data in this phase). */
export interface User {
  id: string;
  fullName: string;
  email: string;
  /** Optional remote avatar URL. Falls back to initials when absent. */
  avatarUrl?: string;
  /** Whether Firebase has confirmed the user owns {@link User.email}. */
  emailVerified: boolean;
  /**
   * Whether the account can sign in with an email and password.
   *
   * Verification is only ever demanded of these accounts: Google and Apple have
   * already proved the address, and an account that has no password to sign in
   * with would be locked out by a gate it can never satisfy.
   */
  hasPasswordProvider: boolean;
}
