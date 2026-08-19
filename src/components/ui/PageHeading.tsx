import type { Ref } from 'react';
import { cn } from '@/lib/cn';

export interface PageHeadingProps {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  /**
   * Focus target on arrival. Pass the ref returned by `useAnnounceOnFocus` so
   * focus lands here rather than staying on a control from the previous page.
   */
  headingRef?: Ref<HTMLHeadingElement>;
  /** `h1` for the page title, `h2` for a section within it. */
  level?: 1 | 2;
  className?: string;
}

/**
 * A page or section heading, replacing the mobile `SectionTitle` / `AuthHeader`.
 *
 * Real `<h1>`/`<h2>` elements, so screen-reader heading navigation works and
 * the page has an outline — the mobile app has to fake this with
 * `accessibilityRole="header"`. `tabIndex={-1}` makes the heading
 * programmatically focusable without adding a tab stop, which is what lets
 * `useAnnounceOnFocus` park focus here after a route change.
 */
export function PageHeading({
  title,
  subtitle,
  align = 'left',
  headingRef,
  level = 1,
  className,
}: PageHeadingProps) {
  const Tag = level === 1 ? 'h1' : 'h2';

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className,
      )}>
      <Tag
        ref={headingRef}
        tabIndex={-1}
        className={cn(
          'font-bold text-foreground outline-none',
          level === 1 ? 'text-2xl' : 'text-xl font-semibold',
        )}>
        {title}
      </Tag>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
