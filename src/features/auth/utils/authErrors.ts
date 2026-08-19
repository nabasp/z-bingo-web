/**
 * Ported verbatim from the React Native app: `bingo/src/features/auth/utils/authErrors.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import { ApiError } from '@/lib/apiClient';

/**
 * Translate any thrown error into a friendly, user-facing message.
 *
 * Handles Firebase Auth errors (`auth/*` codes) from the client SDK and
 * {@link ApiError}s from the backend, with a guaranteed fallback so raw errors
 * are never shown.
 */
export function getAuthErrorMessage(error: unknown): string {
  const code = firebaseCode(error);
  if (code) {
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger one.';
      case 'auth/account-exists-with-different-credential':
        return 'This email is already registered with a different sign-in method. Please sign in that way instead.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again in a moment.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  if (error instanceof ApiError) {
    switch (error.code) {
      case 'session_expired':
        return 'Your session has expired. Please sign in again.';
      case 'network':
        return 'Network error. Please check your connection and try again.';
      case 'validation_error':
        return error.message || 'Please check the highlighted fields.';
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  }

  return 'Something went wrong. Please try again.';
}

/** Extract a Firebase Auth error code (`auth/...`) if present. */
function firebaseCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string' && code.startsWith('auth/')) return code;
  }
  return null;
}
