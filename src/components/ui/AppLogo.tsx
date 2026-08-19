import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'h-9 w-9 text-base',
  md: 'h-12 w-12 text-xl',
  lg: 'h-16 w-16 text-2xl',
} as const;

/**
 * Placeholder brand mark — a rounded primary tile with the app initial,
 * matching the mobile `AppLogo`. Swap for a real asset when branding exists.
 */
export function AppLogo({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground',
        SIZES[size],
        className,
      )}>
      B
    </span>
  );
}
