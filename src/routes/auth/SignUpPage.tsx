import { AppLogo, PageHeading, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { SignUpForm } from '@/features/auth/forms';
import { PATHS } from '../paths';

export function SignUpPage() {
  const headingRef = useAnnounceOnFocus({
    title: 'Create account',
    detail: 'Fill in your details to create an account.',
  });

  return (
    <PageShell center width="narrow">
      <div className="flex flex-col items-center gap-4">
        <AppLogo size="lg" />
        <PageHeading
          headingRef={headingRef}
          align="center"
          title="Create your account"
          subtitle="Sign up to get started"
        />
      </div>
      <SignUpForm signInTo={PATHS.signIn} />
    </PageShell>
  );
}
