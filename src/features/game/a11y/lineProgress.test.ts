import { describe, expect, it } from 'vitest';
import type { Cell } from '../types';
import {
  describeNeed,
  describeNearStrikes,
  nearStrikes,
  needFor,
  needThrough,
} from './lineProgress';

const SIZE = 3;

/** A 3×3 board whose marked cells are the indices given. */
function board(marked: number[]): Cell[] {
  const values = [1, 2, 4, 5, 9, 6, 7, 3, 8];
  return values.map((value, index) => ({
    index,
    value,
    marked: marked.includes(index),
  }));
}

describe('needFor', () => {
  it('lists the unmarked cells of a line in reading order', () => {
    const need = needFor(board([3, 5]), SIZE, 'row', 1);
    expect(need).toEqual({ type: 'row', index: 1, needed: [4] });
  });

  it('returns an empty list for a completed line', () => {
    expect(needFor(board([0, 1, 2]), SIZE, 'row', 0)?.needed).toEqual([]);
  });

  it('returns null for a line that does not exist', () => {
    expect(needFor(board([]), SIZE, 'row', 9)).toBeNull();
  });
});

describe('needThrough', () => {
  it('finds the row through a cell', () => {
    expect(needThrough(board([3, 5]), SIZE, 4, 'row')?.index).toBe(1);
  });

  it('finds the column through a cell', () => {
    expect(needThrough(board([1, 7]), SIZE, 4, 'col')?.index).toBe(1);
  });
});

describe('nearStrikes', () => {
  it('finds every line exactly one cell from completing', () => {
    // Marking the top-left and centre leaves the main diagonal needing C3.
    const needs = nearStrikes(board([0, 4]), SIZE);
    expect(needs).toContainEqual({ type: 'diag', index: 0, needed: [8] });
  });

  it('ignores lines that are already complete', () => {
    const needs = nearStrikes(board([0, 1, 2]), SIZE);
    expect(needs.some(need => need.type === 'row' && need.index === 0)).toBe(false);
  });

  it('ignores lines two or more cells away', () => {
    expect(nearStrikes(board([0]), SIZE)).toEqual([]);
  });

  it('says nothing about a board that has not been dealt yet', () => {
    expect(nearStrikes([], SIZE)).toEqual([]);
  });
});

describe('describeNeed', () => {
  it('names the line, the count and the cells', () => {
    const need = needFor(board([3, 5]), SIZE, 'row', 1)!;
    expect(describeNeed(need, SIZE, 'chess')).toBe('Row 2 needs 1 cell: B2.');
  });

  it('keeps the count and the list in agreement when more than one is missing', () => {
    // The spec writes "needs 1 cell" and then names two; this does not.
    const need = needFor(board([2]), SIZE, 'anti', 0)!;
    expect(describeNeed(need, SIZE, 'chess')).toBe(
      'Anti-diagonal needs 2 cells: B2, A3.',
    );
  });

  it('pluralises cells', () => {
    const need = needFor(board([0]), SIZE, 'col', 0)!;
    expect(describeNeed(need, SIZE, 'chess')).toBe('Column A needs 2 cells: A2, A3.');
  });

  it('says so rather than listing nothing when a line is done', () => {
    const need = needFor(board([0, 1, 2]), SIZE, 'row', 0)!;
    expect(describeNeed(need, SIZE, 'chess')).toBe('Row 1 is complete.');
  });

  it('follows the row-and-column notation when that is what is chosen', () => {
    const need = needFor(board([3, 5]), SIZE, 'row', 1)!;
    expect(describeNeed(need, SIZE, 'rowcol')).toBe('Row 2 needs 1 cell: R2, C2.');
  });
});

describe('describeNearStrikes', () => {
  it('is silent when nothing is close', () => {
    expect(describeNearStrikes([], SIZE, 'chess')).toBeNull();
  });

  it('names the line and the missing cell', () => {
    const needs = [{ type: 'col' as const, index: 1, needed: [7] }];
    expect(describeNearStrikes(needs, SIZE, 'chess')).toBe(
      '1 strike away: Column B at B3.',
    );
  });

  it('joins several with an "and", so they do not run together', () => {
    const needs = [
      { type: 'row' as const, index: 0, needed: [2] },
      { type: 'col' as const, index: 1, needed: [7] },
    ];
    expect(describeNearStrikes(needs, SIZE, 'chess')).toBe(
      '2 strikes away: Row 1 at C1 and Column B at B3.',
    );
  });
});
