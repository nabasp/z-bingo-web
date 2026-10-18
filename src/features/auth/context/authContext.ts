import { createContext } from 'react';
import type { User } from '@/types';
import type { SignInValues, SignUpValues } from '../types';

export type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated';

export interface SignUpOutcome {
  message: string;
  /** True when the account still needs email verification. */
  needsVerification: boolean;
}

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /**
   * True while a signed-in email/password account has not confirmed its
   * address. The route guards hold such a session at `VerifyEmailPage`.
   */
  needsEmailVerification: boolean;
  login: (values: SignInValues) => Promise<void>;
  /** Google popup sign-in. Resolves to `false` if the user cancelled. */
  loginWithGoogle: () => Promise<boolean>;
  signup: (values: SignUpValues) => Promise<SignUpOutcome>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Re-send the confirmation mail to the signed-in user. Throws on failure. */
  resendVerificationEmail: () => Promise<void>;
}

/**
 * The context object lives in its own module, apart from the provider
 * component.
 *
 * This is not organisational tidiness: React Fast Refresh re-evaluates a
 * changed module, and a file that exports both a component and a
 * `createContext` call gets a BRAND NEW context object on every edit — while
 * the already-mounted tree still holds the old one. Every consumer then reads
 * `undefined` and the app dies with "must be used within a Provider" until a
 * full reload. Keeping the context in a component-free module makes it stable
 * across hot updates.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
