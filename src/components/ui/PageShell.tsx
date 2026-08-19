import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageShellProps {
  children: ReactNode;
  /** Vertically centre the content (used by the auth pages). */
  center?: boolean;
  /**
   * Content width cap. `narrow` suits forms, `default` the standard column,
   * `wide` the two-column game and lobby layouts on desktop.
   */
  width?: 'narrow' | 'default' | 'wide';
  className?: string;
}

const WIDTHS = {
  narrow: 'max-w-md',
  default: 'max-w-2xl',
  wide: 'max-w-6xl',
} as const;

/**
 * Standard page shell — the web counterpart of the mobile `ScreenContainer`.
 *
 * The mobile version handles safe areas, keyboard avoidance and scrolling,
 * none of which a browser needs. What it does need instead is a width cap: the
 * app's layouts are designed for a ~360dp column, and stretched across a
 * 1920px monitor they fall apart. Everything is mobile-first and grows into a
 * centred column, widening only where a page has a genuine second column.
 */
export function PageShell({
  children,
  center = false,
  width = 'default',
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8',
        WIDTHS[width],
        center && 'min-h-[calc(100dvh-4rem)] justify-center',
        className,
      )}>
      {children}
    </div>
  );
}
