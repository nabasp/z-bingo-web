import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInValues } from '../schemas';
import { useAuth } from '../context';
import { getAuthErrorMessage } from '../utils';

/**
 * Sign In form: RHF + Zod validation, delegating auth to {@link useAuth}.
 * On success, auth state flips to `authenticated` and the router swaps to the
 * app — no manual navigation needed.
 */
export function useSignInForm() {
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async values => {
    setErrorMessage(null);
    try {
      await login(values);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    }
  });

  return {
    control: form.control,
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    errorMessage,
  };
}
