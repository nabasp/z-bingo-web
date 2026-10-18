// Imported from the module rather than the `@/lib` barrel on purpose: the
// barrel reaches AudioManager and its native player, which would drag a native
// dependency into what is otherwise pure, directly testable logic.
import { sentence } from '@/lib/a11y/phrases';
import {
  coordOf,
  onAntiDiagonal,
  onMainDiagonal,
  type Notation,
} from './boardCoords';

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
 * `notation` arrives the same way, as a primitive prop, rather than being read
 * from the preference store in here: a store read would make this impure and
 * would move the subscription inside the memo boundary, where it would defeat
 * it.
 */

// Re-exported so the geometry helpers keep their long-standing import path.
// `boardCoords` is where they live now, because the line and board readouts
// need them too and must not import the cell label to get them.
export {
  columnOf,
  onAntiDiagonal,
  onMainDiagonal,
  rowOf,
  type Notation,
} from './boardCoords';

/** Play marks cells; setup swaps them. The two never share a vocabulary. */
export type BoardVariant = 'play' | 'setup';

/**
 * Where the cell sits — `B2` in chess notation, `R2, C2` in the other — plus
 * `D1`/`D2` when it is on a diagonal, and both for the centre of an odd board.
 *
 * Abbreviated because this is heard on *every* swipe across N² cells; "Row two,
 * column two" spent most of its breath on two words that never change. The
 * diagonals are named even under chess notation, where the coordinate is
 * shorter still: they are the two winnable lines a player cannot infer from the
 * row and column alone, and that is as true of `B2` as it was of `R2, C2`.
 */
export function positionOf(
  index: number,
  size: number,
  notation: Notation = 'rowcol',
): string {
  const parts = [coordOf(index, size, notation)];
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
  /** The player's choice of coordinate vocabulary. */
  notation?: Notation;
}

export function cellLabel({
  index,
  size,
  value,
  variant,
  marked,
  selected,
  inCompletedLine,
  notation = 'rowcol',
}: CellLabelOptions): string {
  const position = positionOf(index, size, notation);

  // "blank", not "empty": the spec words it that way in prose rather than in
  // an example, and it is the one word a player hears on every cell they have
  // not reached yet.
  if (value === null) return `${position}, blank`;

  return sentence(
    `${position}, ${value}`,
    // "not marked" is said out loud during play because the whole game is
    // knowing which of your numbers are still open. During setup there is
    // nothing to mark, so the state word is "filled" — which is what the cell
    // just became, and the confirmation the player is listening for.
    variant === 'play' ? (marked ? 'marked' : 'not marked') : 'filled',
    inCompletedLine ? 'part of a completed line' : undefined,
    variant === 'setup' && selected ? 'selected for swap' : undefined,
  );
  // What you can *do* with the cell is deliberately absent: that belongs in
  // `accessibilityHint`, which screen readers speak after a pause and which the
  // user can switch off.
}
