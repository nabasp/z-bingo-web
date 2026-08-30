import { memo } from 'react';
import { cn } from '@/lib/cn';

export interface BannerProps {
  /**
   * `info` and `success` render identically — both are the calm, muted
   * treatment. They are distinct so the call site says what it means: a room
   * closing because nobody joined is neither a failure nor an achievement.
   */
  variant: 'error' | 'success' | 'info';
  children: string;
  /** Adds a dismiss control. Omit for messages that clear themselves. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Inline banner for form-level feedback (submission errors, success notices,
 * rejected moves). The web counterpart of the mobile `FormMessage`.
 *
 * These appear without the player doing anything that moves focus — a failed
 * sign-in, a rejected move, a server error mid-match. `role="alert"` (which
 * implies `aria-live="assertive"`) is what makes a screen reader volunteer the
 * text instead of waiting to be navigated onto it; success notices are only
 * `polite` because nothing has gone wrong.
 */
export const Banner = memo(function Banner({
  variant,
  children,
  onDismiss,
  className,
}: BannerProps) {
  const isError = variant === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border p-3',
        isError
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-border bg-muted',
        className,
      )}>
      <p
        className={cn(
          'flex-1 text-sm',
          onDismiss ? 'text-left' : 'text-center',
          isError ? 'text-destructive' : 'text-foreground',
        )}>
        {children}
      </p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            'hover:bg-foreground/10',
            isError ? 'text-destructive' : 'text-foreground',
          )}>
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      ) : null}
    </div>
  );
});
