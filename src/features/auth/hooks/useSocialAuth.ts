import { useState } from 'react';
import { useAuth } from '../context';
import { logOAuthError } from '../services';
import { getAuthErrorMessage } from '../utils';

/**
 * Drives the Google sign-in button. On success, {@link useAuth} flips global
 * auth state and the router swaps to the app — no manual navigation.
 * Cancellation (the user closes the popup) is a silent no-op.
 */
export function useSocialAuth() {
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onGoogle = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      logOAuthError('google sign-in', error);
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  return {
    googleLoading,
    anyLoading: googleLoading,
    errorMessage,
    onGoogle,
  };
}
