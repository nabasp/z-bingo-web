import { columnOf, rowOf } from './boardCoords';

/**
 * What to say when a move runs off the board.
 *
 * Ported verbatim from the React Native app: `bingo-react-native/src/features/game/a11y/edges.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * **Why it is said at all.** The grid clamps at its edges and swallows the key,
 * so pressing Left on column A did nothing and announced nothing. To a sighted
 * player that is obvious — the cursor visibly did not move. To a blind player
 * it is indistinguishable from a dropped keypress, and the usual response is to
 * press it again, harder, and lose track of where they are. Naming the edge
 * costs one short phrase and removes the ambiguity entirely.
 */

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/**
 * Every edge the cell is against, not only the one that blocked the move.
 *
 * A player who presses Left in the top-left corner is told "Top left edge", so
 * one keypress locates them absolutely. Reporting only the edge they hit would
 * have made the corners indistinguishable from the sides.
 */
export function edgesAt(index: number, size: number): string[] {
  const row = rowOf(index, size);
  const column = columnOf(index, size);
  const names: string[] = [];
  if (row === 0) names.push('Top');
  if (row === size - 1) names.push('Bottom');
  if (column === 0) names.push('left');
  if (column === size - 1) names.push('right');
  return names;
}

/** True when the arrow would leave the board. */
export function isBlocked(index: number, size: number, key: ArrowKey): boolean {
  const row = rowOf(index, size);
  const column = columnOf(index, size);
  switch (key) {
    case 'ArrowUp':
      return row === 0;
    case 'ArrowDown':
      return row === size - 1;
    case 'ArrowLeft':
      return column === 0;
    case 'ArrowRight':
      return column === size - 1;
  }
}

/**
 * The announcement for a blocked arrow, or null when the move is legal.
 *
 * A 1×1 board would be against all four edges at once; the size floor is 3, so
 * at most two names ever combine and "Top left edge" is the longest form.
 */
export function edgeNameAt(
  index: number,
  size: number,
  key: ArrowKey,
): string | null {
  if (!isBlocked(index, size, key)) return null;
  const names = edgesAt(index, size);
  if (names.length === 0) return null;
  // "left" and "right" are lower case in `edgesAt` so that "Top left edge"
  // reads as one phrase rather than two proper nouns. A cell against only a
  // side would otherwise start mid-sentence, so the first letter is raised
  // here, where the phrase is finished.
  const phrase = names.join(' ');
  return `${phrase[0].toUpperCase()}${phrase.slice(1)} edge`;
}
