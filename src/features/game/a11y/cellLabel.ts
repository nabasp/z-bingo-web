/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/a11y/cellLabel.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

// Imported from the module rather than the `@/src/lib` barrel on purpose: the
// barrel reaches AudioManager and its native player, which would drag a native
// dependency into what is otherwise pure, directly testable logic.
import { sentence } from '@/lib/a11y/phrases';

/**
 * The spoken name of a single board cell.
 *
 * Every cell is its own accessibility node, so this string is what a blind
 * player hears on each swipe. The order matters: position first (so you always
 * know where you are), then the number, then its state. Anything conditional
 * goes last.
 *
 * Pure on purpose — no React, no native module, no `Cell` objects — so the
 * wording is directly unit-testable, and so `BoardCell` can build its own label
 * inside its `memo` boundary instead of receiving N² strings from the parent.
 */

/** Play marks cells; setup swaps them. The two never share a vocabulary. */
export type BoardVariant = 'play' | 'setup';

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

/**
 * Where the cell sits, e.g. `R2, C2` — or `R2, C2, D1, D2` for the centre of an
 * odd board, which is on both diagonals at once.
 *
 * Abbreviated because this is heard on *every* swipe across N² cells; "Row two,
 * column two" spent most of its breath on two words that never change. The
 * diagonals are named only when the cell is actually on one: they are the two
 * winnable lines a player cannot infer from the row and column alone.
 */
export function positionOf(index: number, size: number): string {
  const parts = [`R${rowOf(index, size) + 1}`, `C${columnOf(index, size) + 1}`];
  if (onMainDiagonal(index, size)) parts.push('D1');
  if (onAntiDiagonal(index, size)) parts.push('D2');
  return parts.join(', ');
}

export interface CellLabelOptions {
  index: number;
  size: number;
  value: number | null;
  variant: BoardVariant;
  /** Play only: the number has been called. Ignored during setup. */
  marked: boolean;
  /** Setup only: this cell is the pending swap pick. Ignored during play. */
  selected: boolean;
  inCompletedLine: boolean;
}

export function cellLabel({
  index,
  size,
  value,
  variant,
  marked,
  selected,
  inCompletedLine,
}: CellLabelOptions): string {
  const position = positionOf(index, size);

  if (value === null) return `${position}, empty`;

  return sentence(
    `${position}, ${value}`,
    // "not marked" is said out loud during play because the whole game is
    // knowing which of your numbers are still open. During setup nothing is
    // ever marked, so saying it on all N² cells would be noise.
    variant === 'play' ? (marked ? 'marked' : 'not marked') : undefined,
    inCompletedLine ? 'part of a completed line' : undefined,
    variant === 'setup' && selected ? 'selected for swap' : undefined,
  );
  // What you can *do* with the cell is deliberately absent: that belongs in
  // `accessibilityHint`, which screen readers speak after a pause and which the
  // user can switch off.
}
