import { Banner, Button, PasswordField, TextField, TextLink } from '@/components/ui';
import { useSignInForm } from '../hooks';
import type { SignInValues } from '../types';
import { SocialAuthButtons } from './SocialAuthButtons';

export interface SignInFormProps {
  forgotPasswordTo: string;
  createAccountTo: string;
}

/**
 * Sign In form. On success, {@link useSignInForm} flips global auth state and
 * the router swaps to the app automatically.
 */
export function SignInForm({ forgotPasswordTo, createAccountTo }: SignInFormProps) {
  const { control, onSubmit, isSubmitting, errorMessage } = useSignInForm();

  return (
    // A real <form>, so Enter submits from any field — the keyboard behaviour
    // people expect on the web and something the mobile screens cannot offer.
    <form noValidate onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      {errorMessage ? <Banner variant="error">{errorMessage}</Banner> : null}

      <SocialAuthButtons />

      <div className="flex w-full flex-col gap-4">
        <TextField<SignInValues>
          control={control}
          name="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
        />

        <PasswordField<SignInValues>
          control={control}
          name="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
        />

        <div className="flex justify-end">
          <TextLink label="Forgot password?" to={forgotPasswordTo} />
        </div>
      </div>

      <Button type="submit" fullWidth loading={isSubmitting}>
        Sign In
      </Button>

      <p className="flex justify-center gap-1.5 text-sm text-muted-foreground">
        Don't have an account?
        <TextLink label="Create account" to={createAccountTo} />
      </p>
    </form>
  );
}
