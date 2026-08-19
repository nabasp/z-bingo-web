import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@/types';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type SignUpOutcome,
} from './authContext';
import {
  authService,
  isOAuthCancelled,
  mapFirebaseUser,
  onAuthChanged,
  reloadUser,
} from '../services';
import type { SignInValues, SignUpValues } from '../types';

/**
 * Owns authentication state.
 *
 * Firebase persists the session in the browser and auto-refreshes tokens, so
 * this provider just subscribes to auth-state changes — the listener fires on
 * load with the restored user (or null) and on every sign-in/out, driving
 * `status` and swapping the router's route group automatically.
 *
 * Structurally identical to `bingo/src/features/auth/context/AuthProvider.tsx`;
 * only the Apple entry point is gone, since Apple sign-in is iOS-only.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('restoring');

  useEffect(() => {
    const unsubscribe = onAuthChanged(firebaseUser => {
      if (firebaseUser) {
        setUser(mapFirebaseUser(firebaseUser));
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    });
    return unsubscribe;
  }, []);

  // Sign-in/up/out just trigger Firebase; the listener above updates state.
  const login = useCallback((values: SignInValues) => authService.signIn(values), []);

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      await authService.signInWithGoogle();
      return true;
    } catch (error) {
      if (isOAuthCancelled(error)) return false;
      throw error;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const refreshed = await reloadUser();
    if (refreshed) setUser(refreshed);
  }, []);

  const signup = useCallback(
    async (values: SignUpValues): Promise<SignUpOutcome> => {
      await authService.signUp(values);
      // Firebase signs the new user in immediately; the listener authenticates
      // and the router swaps. A verification email is sent in the background.
      //
      // `onAuthStateChanged` does NOT re-fire for a profile update, so the
      // display name set during sign-up would otherwise be missing until the
      // next reload. Pull it through explicitly.
      await refreshUser();
      return { message: 'Account created.', needsVerification: true };
    },
    [refreshUser],
  );

  const logout = useCallback(() => authService.signOut(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      loginWithGoogle,
      signup,
      logout,
      refreshUser,
    }),
    [user, status, login, loginWithGoogle, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
