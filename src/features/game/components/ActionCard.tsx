import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface ActionCardProps {
  title: string;
  subtitle: string;
  /** Single glyph placeholder for the leading icon (no icon library). */
  glyph: string;
  to: string;
  /** 'primary' = filled; 'default' = dark card. */
  variant?: 'primary' | 'default';
}

/**
 * Large clickable row used on Home for Create Room / Join Room.
 *
 * A real `<Link>` rather than a button with an onClick, so it can be opened in
 * a new tab, bookmarked and middle-clicked like anything else on the web.
 */
export function ActionCard({
  title,
  subtitle,
  glyph,
  to,
  variant = 'default',
}: ActionCardProps) {
  const primary = variant === 'primary';

  return (
    <Link
      to={to}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl p-5 transition-colors',
        primary
          ? 'bg-primary hover:bg-primary/90'
          : 'border border-border bg-card hover:border-ring',
      )}>
      <span className="flex min-w-0 flex-1 items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg',
            primary ? 'bg-black/10 text-neutral-900' : 'bg-background text-foreground',
          )}>
          {glyph}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              'text-base font-bold',
              primary ? 'text-primary-foreground' : 'text-foreground',
            )}>
            {title}
          </span>
          <span
            className={cn(
              'text-sm',
              // The mobile app measured `text-neutral-900/50` here at 3.35:1,
              // below AA. `/70` is the fixed value.
              primary ? 'text-neutral-900/70' : 'text-muted-foreground',
            )}>
            {subtitle}
          </span>
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'text-lg',
          primary ? 'text-primary-foreground' : 'text-muted-foreground',
        )}>
        ›
      </span>
    </Link>
  );
}
