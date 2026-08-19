/**
 * Ported verbatim from the React Native app: `bingo/src/lib/a11y/phrases.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

/**
 * Shared wording for anything spoken aloud.
 *
 * Screen readers are unforgiving about inconsistency — "R3, C2" in one place and
 * "row 3, column 2" in another forces the listener to re-learn the format. Every
 * spoken string is built from these helpers so the vocabulary stays uniform.
 * Board positions are the one exception, built by `positionOf` in
 * `features/game/a11y/cellLabel.ts` — they are heard on every swipe, so they are
 * deliberately terser than prose.
 */

const ORDINALS = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

/** `1 → "first"`, falling back to "11th" style beyond the tenth. */
export function ordinal(n: number): string {
  if (n >= 1 && n <= ORDINALS.length) return ORDINALS[n - 1];
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** `plural(1, 'line') → "1 line"`, `plural(3, 'line') → "3 lines"`. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : pluralForm ?? `${singular}s`;
  return `${count} ${word}`;
}

/** Drops empty parts and joins with sentence breaks TalkBack pauses on. */
export function sentence(...parts: Array<string | null | undefined | false>): string {
  return parts.filter(Boolean).join('. ');
}

/** Comma list with a trailing "and", for player names and similar. */
export function list(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Room codes are two hyphenated words ("brave-otter"). The hyphen makes TalkBack
 * run them together or spell out punctuation, so speak them as separate words.
 */
export function spokenRoomCode(code: string): string {
  return code.split('-').join(' ');
}

/** `"5 seconds"` / `"1 second"`. */
export function seconds(n: number): string {
  return plural(n, 'second');
}

/** A player's name as it should be spoken, collapsing self-reference. */
export function playerName(name: string, isYou: boolean): string {
  return isYou ? 'You' : name;
}
