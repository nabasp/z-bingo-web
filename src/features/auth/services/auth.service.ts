import type { ForgotPasswordValues, SignInValues, SignUpValues } from '../types';
import {
  sendReset,
  signInEmail,
  signInWithGoogle,
  signOutFirebase,
  signUpEmail,
} from './firebaseAuth';

/**
 * Auth service — the app-facing gateway.
 *
 * Authentication is handled entirely by the Firebase SDK (see
 * {@link firebaseAuth}); this layer just adapts the app's form values to it.
 * On success, `onAuthChanged` in the AuthProvider flips global auth state and
 * the router swaps route groups automatically — these methods resolve to `void`.
 */
export const authService = {
  signIn(values: SignInValues): Promise<void> {
    return signInEmail(values.email, values.password);
  },

  signUp(values: SignUpValues): Promise<void> {
    return signUpEmail(values.email, values.password, values.fullName);
  },

  requestPasswordReset(values: ForgotPasswordValues): Promise<void> {
    return sendReset(values.email);
  },

  signInWithGoogle(): Promise<void> {
    return signInWithGoogle();
  },

  signOut(): Promise<void> {
    return signOutFirebase();
  },
};
