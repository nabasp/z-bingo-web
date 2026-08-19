import type { ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface TextLinkProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  label: string;
  /** Renders a real anchor when given — right for navigation, wrong for actions. */
  to?: string;
  className?: string;
}

/**
 * Inline, link-styled control for in-app navigation and small actions
 * (e.g. "Create account", "Forgot password?", "Log out").
 *
 * With `to` it is an `<a>`, so it can be middle-clicked, copied and opened in a
 * new tab like any other link — something the mobile `TextLink` could not offer.
 * Without it, it is a `<button>`, because an action that is not a destination
 * should not look like one to assistive tech.
 */
export function TextLink({ label, to, className, ...rest }: TextLinkProps) {
  const classes = cn(
    'rounded text-sm font-semibold text-primary underline-offset-4',
    'hover:underline disabled:opacity-50',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {label}
    </button>
  );
}
