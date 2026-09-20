// Imported from the module rather than the `@/lib` barrel on purpose: the
// barrel reaches AudioManager and its native player, which would drag a native
// dependency into what is otherwise pure, directly testable logic.
import { list, plural } from '@/lib/a11y/phrases';
import { buildLines } from '../utils';
import type { Cell, LineDescriptor, LineType } from '../types';
import { coordList, lineName, type Notation } from './boardCoords';

/**
 * How close a line is to completing, and which cells are still missing.
 *
 * Ported verbatim from the React Native app: `bingo-react-native/src/features/game/a11y/lineProgress.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * **Why this exists.** A sighted player sees at a glance that a row needs one
 * more number; that is the single biggest advantage the screen gives them, and
 * nothing in the game spoke it. The server does not compute it either — the
 * only progress on the wire is `PublicPlayer.letters`, a count of *completed*
 * lines — so it is derived here, from the same `buildLines` the strike overlay
 * already uses.
 */

/**
 * What counts as a cell being done.
 *
 * `'marked'` during play; `'filled'` while the board is being laid out, where
 * nothing is ever marked and asking about marks would answer "needs every
 * cell" on every line of every board. The same keys ask the same question on
 * both stages — this is the word that changes underneath them.
 */
export type LineBasis = 'filled' | 'marked';

export interface LineNeed {
  type: LineType;
  index: number;
  /** Board indices on the line that are not done yet, in reading order. */
  needed: number[];
}

function needOf(line: LineDescriptor, done: Set<number>): LineNeed {
  return {
    type: line.type,
    index: line.index,
    needed: line.cells.filter(cellIndex => !done.has(cellIndex)),
  };
}

function doneIndices(cells: Cell[], basis: LineBasis): Set<number> {
  const isDone = (cell: Cell) =>
    basis === 'filled' ? cell.value !== null : cell.marked;
  return new Set(cells.filter(isDone).map(cell => cell.index));
}

/** What one named line still needs. */
export function needFor(
  cells: Cell[],
  size: number,
  type: LineType,
  index: number,
  basis: LineBasis = 'marked',
): LineNeed | null {
  const line = buildLines(size).find(
    candidate => candidate.type === type && candidate.index === index,
  );
  if (!line) return null;
  return needOf(line, doneIndices(cells, basis));
}

/** The line through a cell, for the row and column readouts. */
export function needThrough(
  cells: Cell[],
  size: number,
  cellIndex: number,
  axis: 'row' | 'col',
  basis: LineBasis = 'marked',
): LineNeed | null {
  const index =
    axis === 'row' ? Math.floor(cellIndex / size) : cellIndex % size;
  return needFor(cells, size, axis, index, basis);
}

/**
 * Every line one cell away from completing.
 *
 * This is the near-*strike* warning, and is deliberately not the same thing as
 * the existing near-*win* cue: that one fires when you are one whole line from
 * the target word. A player can be one cell from a strike on their very first
 * turn.
 */
export function nearStrikes(cells: Cell[], size: number): LineNeed[] {
  if (cells.length < size * size) return [];
  const marked = doneIndices(cells, 'marked');
  return buildLines(size)
    .map(line => needOf(line, marked))
    .filter(need => need.needed.length === 1);
}

/**
 * One line's progress, as a sentence.
 *
 * The count is said as well as the list because the list is the part a listener
 * has to hold in their head — hearing "2 cells" first tells them how much is
 * coming. The spec's example writes "needs 1 cell" and then names two; the
 * count here always agrees with the list.
 */
export function describeNeed(
  need: LineNeed,
  size: number,
  notation: Notation,
): string {
  const name = lineName(need.type, need.index, notation);
  if (need.needed.length === 0) return `${name} is complete.`;
  return `${name} needs ${plural(need.needed.length, 'cell')}: ${coordList(
    need.needed,
    size,
    notation,
  )}.`;
}

/** The near-strike warning, naming every line that is one cell away. */
export function describeNearStrikes(
  needs: LineNeed[],
  size: number,
  notation: Notation,
): string | null {
  if (needs.length === 0) return null;
  const parts = needs.map(
    need =>
      `${lineName(need.type, need.index, notation)} at ${coordList(
        need.needed,
        size,
        notation,
      )}`,
  );
  return `${plural(needs.length, 'strike')} away: ${list(parts)}.`;
}
