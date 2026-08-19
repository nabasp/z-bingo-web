import { Banner, Button, PasswordField, TextField, TextLink } from '@/components/ui';
import { useSignUpForm } from '../hooks';
import type { SignUpValues } from '../types';
import { SocialAuthButtons } from './SocialAuthButtons';

export interface SignUpFormProps {
  signInTo: string;
}

/**
 * Sign Up form. Firebase signs the new account in immediately, so on success
 * the router usually swaps to the app before the confirmation is read.
 */
export function SignUpForm({ signInTo }: SignUpFormProps) {
  const { control, onSubmit, isSubmitting, errorMessage, successMessage } =
    useSignUpForm();

  return (
    <form noValidate onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      {errorMessage ? <Banner variant="error">{errorMessage}</Banner> : null}
      {successMessage ? <Banner variant="success">{successMessage}</Banner> : null}

      <SocialAuthButtons />

      <div className="flex w-full flex-col gap-4">
        <TextField<SignUpValues>
          control={control}
          name="fullName"
          label="Full name"
          placeholder="Alex Morgan"
          autoComplete="name"
        />

        <TextField<SignUpValues>
          control={control}
          name="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
        />

        <PasswordField<SignUpValues>
          control={control}
          name="password"
          label="Password"
          placeholder="Create a password"
          autoComplete="new-password"
        />

        <PasswordField<SignUpValues>
          control={control}
          name="confirmPassword"
          label="Confirm password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" fullWidth loading={isSubmitting}>
        Create Account
      </Button>

      <p className="flex justify-center gap-1.5 text-sm text-muted-foreground">
        Already have an account?
        <TextLink label="Sign in" to={signInTo} />
      </p>
    </form>
  );
}
