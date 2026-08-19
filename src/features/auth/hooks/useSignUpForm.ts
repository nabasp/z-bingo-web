import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpValues } from '../schemas';
import { useAuth } from '../context';
import { getAuthErrorMessage } from '../utils';

export interface UseSignUpFormOptions {
  onSuccess?: () => void;
}

/**
 * Sign Up form: RHF + Zod (incl. password-match).
 *
 * Firebase signs the new account in immediately, so the success message is
 * usually only seen for a moment before the router swaps to the app.
 */
export function useSignUpForm({ onSuccess }: UseSignUpFormOptions = {}) {
  const { signup } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = form.handleSubmit(async values => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const outcome = await signup(values);
      setSuccessMessage(outcome.message);
      form.reset();
      onSuccess?.();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    }
  });

  return {
    control: form.control,
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    errorMessage,
    successMessage,
  };
}
