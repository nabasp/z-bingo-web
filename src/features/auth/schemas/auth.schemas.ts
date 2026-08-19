/**
 * Ported verbatim from the React Native app: `bingo/src/features/auth/schemas/auth.schemas.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import { z } from 'zod';

/**
 * Zod validation schemas for the auth forms.
 *
 * These describe client-side validation only. Firebase Auth enforces the real
 * credential rules (uniqueness, password policy) server-side.
 */

const email = z
  .string()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

const password = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters');

export const signInSchema = z.object({
  email,
  password,
});

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .min(1, 'Full name is required')
      .min(2, 'Full name is too short'),
    email,
    password,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(values => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email,
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
