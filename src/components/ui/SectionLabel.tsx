import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SectionLabelProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

/**
 * The small uppercase label above a group ("RECENT CALLS", "PROGRESS").
 *
 * Pulled out because the mobile screens repeat this exact class string a dozen
 * times, and a single component keeps the tracking and colour consistent.
 */
export function SectionLabel({ children, className, ...rest }: SectionLabelProps) {
  return (
    <span
      className={cn(
        'text-xs font-semibold tracking-wide text-muted-foreground uppercase',
        className,
      )}
      {...rest}>
      {children}
    </span>
  );
}
