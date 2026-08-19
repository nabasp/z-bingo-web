import { AppLogo, PageHeading, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { SignInForm } from '@/features/auth/forms';
import { PATHS } from '../paths';

export function SignInPage() {
  const headingRef = useAnnounceOnFocus({
    title: 'Sign in',
    detail: 'Enter your email and password to continue.',
  });

  return (
    <PageShell center width="narrow">
      <div className="flex flex-col items-center gap-4">
        <AppLogo size="lg" />
        <PageHeading
          headingRef={headingRef}
          align="center"
          title="Welcome back"
          subtitle="Sign in to your account to continue"
        />
      </div>
      <SignInForm
        forgotPasswordTo={PATHS.forgotPassword}
        createAccountTo={PATHS.signUp}
      />
    </PageShell>
  );
}
