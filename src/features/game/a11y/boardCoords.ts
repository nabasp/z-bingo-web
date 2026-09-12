/**
 * Board coordinates, in the two vocabularies the game speaks.
 *
 * Ported verbatim from the React Native app: `bingo-react-native/src/features/game/a11y/boardCoords.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * **Why two.** Chess notation (`B2`) is what most players — sighted or not —
 * already have a mental model for, it is one syllable shorter than `R2, C2`,
 * and it survives being read back in a list ("needs B1, B2") where `R1, C2,
 * R2, C2` becomes an unparseable run of letters and digits. `R2, C2` is kept
 * because it is unambiguous about which axis is which, which is worth more to
 * someone meeting the board for the first time. The player chooses; nothing in
 * this file decides for them.
 */
import type { LineType } from '../types';

export type Notation = 'chess' | 'rowcol';

/**
 * Boards run to 8×8 (server-enforced `MAX_SIZE`), so eight letters is the whole
 * alphabet this game will ever need.
 */
export const COLUMN_LETTERS = 'ABCDEFGH';

export function rowOf(index: number, size: number): number {
  return Math.floor(index / size);
}

export function columnOf(index: number, size: number): number {
  return index % size;
}

/** Top-left to bottom-right. */
export function onMainDiagonal(index: number, size: number): boolean {
  return rowOf(index, size) === columnOf(index, size);
}

/** Top-right to bottom-left. */
export function onAntiDiagonal(index: number, size: number): boolean {
  return rowOf(index, size) + columnOf(index, size) === size - 1;
}

/** The column's spoken name: `0 → "A"`. */
export function columnLetter(column: number): string {
  return COLUMN_LETTERS[column] ?? String(column + 1);
}

/** Chess-style, column first: `index 4` on a 3×3 → `"B2"`. */
export function chessOf(index: number, size: number): string {
  return `${columnLetter(columnOf(index, size))}${rowOf(index, size) + 1}`;
}

/** Row-and-column style: `index 4` on a 3×3 → `"R2, C2"`. */
export function rowColOf(index: number, size: number): string {
  return `R${rowOf(index, size) + 1}, C${columnOf(index, size) + 1}`;
}

/** One cell's coordinate, in whichever vocabulary the player picked. */
export function coordOf(index: number, size: number, notation: Notation): string {
  return notation === 'chess' ? chessOf(index, size) : rowColOf(index, size);
}

/**
 * A list of coordinates as it should be heard.
 *
 * Chess coordinates are self-delimiting, so they take commas. `R2, C2` already
 * contains a comma, so a comma-joined list of them is unreadable — those get
 * sentence breaks instead, which is the one place the two notations cannot
 * share a formatter.
 */
export function coordList(
  indices: number[],
  size: number,
  notation: Notation,
): string {
  const parts = indices.map(index => coordOf(index, size, notation));
  return notation === 'chess' ? parts.join(', ') : parts.join('. ');
}

/**
 * A line's spoken name: `"Row 2"`, `"Column B"`, `"Diagonal"`, `"Anti-diagonal"`.
 *
 * Columns are named by letter under chess notation and by number otherwise, so
 * that "Column B needs B2" and "Column 2 needs R1, C2" each stay internally
 * consistent. The diagonals have no index — there is only ever one of each.
 */
export function lineName(
  type: LineType,
  index: number,
  notation: Notation,
): string {
  switch (type) {
    case 'row':
      return `Row ${index + 1}`;
    case 'col':
      return notation === 'chess'
        ? `Column ${columnLetter(index)}`
        : `Column ${index + 1}`;
    case 'diag':
      return 'Diagonal';
    case 'anti':
      return 'Anti-diagonal';
  }
}
