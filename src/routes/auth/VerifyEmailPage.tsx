import { AppLogo, Banner, Button, PageHeading, PageShell, TextLink } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { useAuth } from '@/features/auth/context';
import { useVerifyEmail } from '@/features/auth/hooks';

/**
 * The verification gate.
 *
 * An account signs in the moment it is created, so this is not a sign-up step
 * the player can skip — it is the whole app for an unconfirmed address, and
 * `RequireAuth` redirects here from anywhere else. The three ways out are all
 * on this page: confirm and come back, resend the mail, or sign out.
 *
 * Deliberately outside `AppLayout`: the nav would offer Home, Friends and
 * Profile, every one of which bounces straight back here.
 */
export function VerifyEmailPage() {
  const { user, logout } = useAuth();
  const { resend, check, isSending, isChecking, secondsLeft, sentMessage, errorMessage } =
    useVerifyEmail();

  const headingRef = useAnnounceOnFocus({
    title: 'Confirm your email',
    detail:
      'We sent a confirmation link to your email address. Open it, then choose I have confirmed it. You can also resend the email or sign out.',
  });

  const canResend = secondsLeft === 0 && !isSending;

  return (
    <PageShell center width="narrow">
      <div className="flex flex-col items-center gap-4">
        <AppLogo size="lg" />
        <PageHeading
          headingRef={headingRef}
          align="center"
          title="Confirm your email"
          subtitle={
            user?.email
              ? `We sent a link to ${user.email}`
              : 'We sent you a confirmation link'
          }
        />
      </div>

      {errorMessage ? <Banner variant="error">{errorMessage}</Banner> : null}
      {sentMessage && !errorMessage ? (
        <Banner variant="success">{sentMessage}</Banner>
      ) : null}

      <div className="w-full rounded-xl border border-border bg-muted p-4">
        <p className="text-sm text-foreground">
          Open the link in that email to finish setting up your account. If it
          hasn't arrived in a minute or two, check your spam folder.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button fullWidth loading={isChecking} onClick={() => void check()}>
          I've confirmed it
        </Button>

        <Button
          variant="outline"
          fullWidth
          loading={isSending}
          disabled={!canResend}
          onClick={() => void resend()}>
          {/*
           * The countdown is in the label rather than a separate line: a
           * disabled button with no stated reason reads as broken, and a
           * screen reader announcing the button gets the reason with it.
           */}
          {secondsLeft > 0 ? `Resend email (${secondsLeft}s)` : 'Resend email'}
        </Button>
      </div>

      <div className="flex justify-center">
        {/* The way out for a mistyped address: sign out, sign up again. */}
        <TextLink label="Sign out" onClick={() => void logout()} />
      </div>
    </PageShell>
  );
}
