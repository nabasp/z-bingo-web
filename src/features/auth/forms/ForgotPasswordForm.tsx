import { Link } from 'react-router-dom';
import { Banner, Button, TextField, TextLink } from '@/components/ui';
import { useForgotPasswordForm } from '../hooks';
import type { ForgotPasswordValues } from '../types';

export interface ForgotPasswordFormProps {
  signInTo: string;
}

/**
 * Forgot Password form: a single email field. On success, shows a confirmation
 * instead of the form.
 *
 * The confirmation is deliberately non-committal about whether the address
 * exists — the same wording the mobile app uses, so the form cannot be used to
 * enumerate accounts.
 */
export function ForgotPasswordForm({ signInTo }: ForgotPasswordFormProps) {
  const { control, onSubmit, isSubmitting, isSuccess, errorMessage } =
    useForgotPasswordForm();

  if (isSuccess) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="w-full rounded-xl border border-border bg-muted p-4">
          <p className="text-center text-sm text-foreground">
            If an account exists for that email, we've sent a link to reset your
            password.
          </p>
        </div>
        <Link
          to={signInTo}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-secondary px-5 text-base font-semibold text-secondary-foreground hover:bg-secondary/80">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      {errorMessage ? <Banner variant="error">{errorMessage}</Banner> : null}

      <TextField<ForgotPasswordValues>
        control={control}
        name="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
      />

      <Button type="submit" fullWidth loading={isSubmitting}>
        Reset Password
      </Button>

      <div className="flex justify-center">
        <TextLink label="Back to Sign In" to={signInTo} />
      </div>
    </form>
  );
}
