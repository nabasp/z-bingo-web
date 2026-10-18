import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context';
import { cooldownSecondsLeft, getAuthErrorMessage } from '../utils';

/**
 * Drives the verification gate: resend, re-check, and the cooldown between
 * resends.
 *
 * The awkward part of this flow is that confirming happens somewhere else —
 * Firebase's hosted page, usually on a phone — and nothing tells this tab about
 * it. So there are two ways forward and both are covered: an explicit "I've
 * confirmed it" button, and a re-check whenever the tab regains focus, which is
 * exactly the moment a player who verified on another device comes back.
 */
export function useVerifyEmail() {
  const { refreshUser, resendVerificationEmail } = useAuth();

  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The check can outlive the page: verifying flips `needsEmailVerification`,
  // the guard redirects, and a `setState` then lands on a gone component.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // One interval for the countdown label, only while there is one to count.
  useEffect(() => {
    if (lastSentAt === null) return;
    const tick = () => setSecondsLeft(cooldownSecondsLeft(lastSentAt, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lastSentAt]);

  const check = useCallback(async () => {
    setErrorMessage(null);
    setIsChecking(true);
    try {
      await refreshUser();
    } catch (error) {
      if (mounted.current) setErrorMessage(getAuthErrorMessage(error));
    } finally {
      if (mounted.current) setIsChecking(false);
    }
  }, [refreshUser]);

  // Re-check on return to the tab. `visibilitychange` rather than `focus` so a
  // background tab that is simply revealed counts too.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  const resend = useCallback(async () => {
    setErrorMessage(null);
    setSentMessage(null);
    setIsSending(true);
    try {
      await resendVerificationEmail();
      if (!mounted.current) return;
      setLastSentAt(Date.now());
      setSentMessage('Confirmation email sent. Check your inbox and spam folder.');
    } catch (error) {
      if (mounted.current) setErrorMessage(getAuthErrorMessage(error));
    } finally {
      if (mounted.current) setIsSending(false);
    }
  }, [resendVerificationEmail]);

  return {
    resend,
    check,
    isSending,
    isChecking,
    /** Seconds until another resend is allowed; 0 when it is allowed now. */
    secondsLeft,
    sentMessage,
    errorMessage,
  };
}
