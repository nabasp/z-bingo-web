import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'link' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks presses while true. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const VARIANTS: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-card',
  link: 'bg-transparent text-primary underline-offset-4 hover:underline',
  destructive: 'bg-destructive text-white hover:bg-destructive/90',
};

const SIZES: Record<ButtonSize, string> = {
  // 44px minimum height throughout — the WCAG target-size floor, and the same
  // 48dp rule the mobile app applies to its own controls.
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

/**
 * The app's button, replacing the mobile `SubmitButton` (Gluestack `Button`).
 *
 * `loading` implies disabled — a form that is already submitting must not be
 * submitted twice — and `aria-busy` says so out loud rather than leaving a
 * screen reader to infer it from a spinner it cannot see.
 */
export function Button({
  children,
  variant = 'default',
  size = 'lg',
  loading = false,
  fullWidth = false,
  disabled = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = loading || disabled;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}>
      {loading ? <Spinner size="sm" label={null} /> : null}
      {children}
    </button>
  );
}
