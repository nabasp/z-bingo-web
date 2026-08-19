import { AppLogo, PageHeading, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { ForgotPasswordForm } from '@/features/auth/forms';
import { PATHS } from '../paths';

export function ForgotPasswordPage() {
  const headingRef = useAnnounceOnFocus({
    title: 'Reset password',
    detail: 'Enter your email to receive a reset link.',
  });

  return (
    <PageShell center width="narrow">
      <div className="flex flex-col items-center gap-4">
        <AppLogo size="lg" />
        <PageHeading
          headingRef={headingRef}
          align="center"
          title="Reset password"
          subtitle="Enter your email and we'll send you a reset link"
        />
      </div>
      <ForgotPasswordForm signInTo={PATHS.signIn} />
    </PageShell>
  );
}
