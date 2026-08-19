import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';
import { authService } from '../services';
import { getAuthErrorMessage } from '../utils';

/**
 * Forgot Password form. Asks Firebase to send a reset email (no session change)
 * and exposes `isSuccess` so the page can render a confirmation instead.
 */
export function useForgotPasswordForm() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async values => {
    setErrorMessage(null);
    try {
      await authService.requestPasswordReset(values);
      setIsSuccess(true);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    }
  });

  return {
    control: form.control,
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    isSuccess,
    errorMessage,
  };
}
