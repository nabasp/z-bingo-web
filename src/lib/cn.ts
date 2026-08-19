/**
 * Join class names, dropping anything falsy.
 *
 * Deliberately not `clsx`/`tailwind-merge`: the components here are written so
 * that conditional classes never collide, and a 6-line helper beats a
 * dependency for that.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
