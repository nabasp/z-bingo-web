import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { PATHS } from '@/routes/paths';

/**
 * The circular “?” that opens the Game Guide.
 *
 * A `Link`, not a button: it goes somewhere, so it should behave like every
 * other navigation in the app — focusable in the normal tab order, openable in
 * a new tab, and reachable by a screen reader's link list.
 *
 * The glyph itself is `aria-hidden`. A lone "?" read aloud is a punctuation
 * mark, not a name, so the accessible name comes from `aria-label` instead —
 * which is also what makes it findable by voice control ("click help").
 *
 * 44×44 to match every other control here, so it is a comfortable target on a
 * touch screen and an easy one with a shaky hand.
 */
export function HelpButton({ className }: { className?: string }) {
  return (
    <Link
      to={PATHS.guide}
      aria-label="Help and game guide"
      title="Game guide"
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        'border border-border bg-card text-lg font-bold text-foreground',
        'transition-colors hover:border-ring',
        className,
      )}>
      <span aria-hidden="true" className="leading-none">
        ?
      </span>
    </Link>
  );
}
