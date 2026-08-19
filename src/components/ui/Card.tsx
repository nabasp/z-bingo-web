import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** `plain` drops the border, for cards that sit on their own. */
  variant?: 'bordered' | 'plain';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
} as const;

/** The app's surface: a rounded dark panel, matching the mobile `bg-card` rows. */
export function Card({
  children,
  variant = 'bordered',
  padding = 'md',
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-card',
        variant === 'bordered' && 'border border-border',
        PADDING[padding],
        className,
      )}
      {...rest}>
      {children}
    </div>
  );
}
