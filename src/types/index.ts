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
}
