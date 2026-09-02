import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
} as const;

/**
 * Cell centres in the 1024 viewBox. Shared verbatim with `public/favicon.svg`
 * and with `scripts/generate-app-icons.swift` in the mobile repo, so the
 * in-app mark, the favicon and the installed app icons are one drawing.
 */
const CENTRES = [217, 365, 512, 659, 807] as const;
const R_DAUB = 59;
const R_EMPTY = 28;

/**
 * The daubed cells spell a Z: the full top row, the full bottom row, and the
 * anti-diagonal joining them. `row + col === 4` already lands on (0,4) and
 * (4,0), so the three clauses meet at the Z's corners without special cases.
 */
const isDaubed = (row: number, col: number) =>
  row === 0 || row === 4 || row + col === 4;

/**
 * The Zendalona Bingo brand mark: a 5x5 bingo card whose daubed cells spell a Z.
 *
 * Decorative — every caller pairs it with the app name in text, so it is
 * `aria-hidden` and contributes nothing to the accessibility tree.
 *
 * The Z is a *shape*, not a colour difference, so the mark still reads in
 * greyscale, under colour-blind vision, and at 16px. Colours are the fixed
 * brand indigo rather than theme tokens: a logo should not restyle itself with
 * the surface it sits on, and the tile's own ground is what keeps it legible
 * against both light and dark backgrounds.
 */
export function AppLogo({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      focusable="false"
      className={cn(SIZES[size], className)}>
      <rect width="1024" height="1024" rx="224" fill="#4338CA" />
      <g fill="#C7D2FE" fillOpacity={0.5}>
        {CENTRES.map((cy, row) =>
          CENTRES.map((cx, col) =>
            isDaubed(row, col) ? null : (
              <circle key={`${row}-${col}`} cx={cx} cy={cy} r={R_EMPTY} />
            ),
          ),
        )}
      </g>
      <g fill="#fff">
        {CENTRES.map((cy, row) =>
          CENTRES.map((cx, col) =>
            isDaubed(row, col) ? (
              <circle key={`${row}-${col}`} cx={cx} cy={cy} r={R_DAUB} />
            ) : null,
          ),
        )}
      </g>
    </svg>
  );
}
