import { describe, expect, it } from 'vitest';
import { cellLabel, columnOf, positionOf, rowOf } from './cellLabel';

const SIZE = 3;

describe('grid helpers', () => {
  it('maps flat indices to rows and columns', () => {
    expect(rowOf(4, SIZE)).toBe(1);
    expect(columnOf(4, SIZE)).toBe(1);
    expect(rowOf(8, SIZE)).toBe(2);
    expect(columnOf(8, SIZE)).toBe(2);
  });
});

describe('positionOf', () => {
  it('abbreviates row and column, since this is heard on every swipe', () => {
    expect(positionOf(1, SIZE)).toBe('R1, C2');
  });

  it('names the main diagonal', () => {
    expect(positionOf(0, SIZE)).toBe('R1, C1, D1');
    expect(positionOf(8, SIZE)).toBe('R3, C3, D1');
  });

  it('names the anti-diagonal', () => {
    expect(positionOf(2, SIZE)).toBe('R1, C3, D2');
    expect(positionOf(6, SIZE)).toBe('R3, C1, D2');
  });

  it('names both on the centre of an odd board, which sits on each', () => {
    expect(positionOf(4, SIZE)).toBe('R2, C2, D1, D2');
  });

  it('says nothing about diagonals for a cell on neither', () => {
    expect(positionOf(1, SIZE)).not.toContain('D');
    expect(positionOf(5, SIZE)).toBe('R2, C3');
  });

  it('has no centre cell on an even board', () => {
    // 4×4: index 5 is (1,1) — main diagonal only, not both.
    expect(positionOf(5, 4)).toBe('R2, C2, D1');
  });
});

/** A playable cell at index 4 of a 3×3, with everything off by default. */
function label(overrides: Partial<Parameters<typeof cellLabel>[0]> = {}) {
  return cellLabel({
    index: 4,
    size: SIZE,
    value: 5,
    variant: 'play',
    marked: false,
    selected: false,
    inCompletedLine: false,
    ...overrides,
  });
}

describe('cellLabel', () => {
  it('leads with position so you always know where you are', () => {
    expect(label()).toBe('R2, C2, D1, D2, 5. not marked');
  });

  it('reports a marked cell', () => {
    expect(label({ marked: true })).toBe('R2, C2, D1, D2, 5. marked');
  });

  it('says "not marked" during play, so an open number is unambiguous', () => {
    expect(label({ marked: false })).toContain('not marked');
  });

  it('says "filled" rather than a marked state during setup', () => {
    // Nothing is ever marked while the board is being laid out, so the state
    // word is the one the player is actually listening for: the cell took the
    // number. "marked" would be a lie and silence would be no confirmation.
    const setup = label({ variant: 'setup' });
    expect(setup).toBe('R2, C2, D1, D2, 5. filled');
    expect(setup).not.toContain('marked');
  });

  it('mentions a completed line', () => {
    expect(label({ marked: true, inCompletedLine: true })).toBe(
      'R2, C2, D1, D2, 5. marked. part of a completed line',
    );
  });

  it('flags the cell picked for a swap during setup', () => {
    expect(label({ variant: 'setup', selected: true })).toContain(
      'selected for swap',
    );
  });

  it('ignores the swap flag during play', () => {
    expect(label({ selected: true })).not.toContain('selected for swap');
  });

  it('handles a cell with no number in it', () => {
    expect(label({ index: 0, value: null, variant: 'setup' })).toBe(
      'R1, C1, D1, blank',
    );
  });

  // The affordance lives in `accessibilityHint` now. Keeping it out of the
  // label is what stops it being re-spoken on every swipe.
  it('never puts the action in the label', () => {
    expect(label()).not.toContain('Double tap');
    expect(label({ variant: 'setup' })).not.toContain('Double tap');
  });
});
