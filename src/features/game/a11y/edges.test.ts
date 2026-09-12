import { describe, expect, it } from 'vitest';
import { edgeNameAt, edgesAt, isBlocked } from './edges';

const SIZE = 3;

describe('isBlocked', () => {
  it('blocks each arrow at its own edge', () => {
    expect(isBlocked(0, SIZE, 'ArrowUp')).toBe(true);
    expect(isBlocked(0, SIZE, 'ArrowLeft')).toBe(true);
    expect(isBlocked(8, SIZE, 'ArrowDown')).toBe(true);
    expect(isBlocked(8, SIZE, 'ArrowRight')).toBe(true);
  });

  it('allows a move back into the board', () => {
    expect(isBlocked(0, SIZE, 'ArrowDown')).toBe(false);
    expect(isBlocked(0, SIZE, 'ArrowRight')).toBe(false);
  });

  it('blocks nothing in the middle', () => {
    expect(isBlocked(4, SIZE, 'ArrowUp')).toBe(false);
    expect(isBlocked(4, SIZE, 'ArrowLeft')).toBe(false);
  });
});

describe('edgesAt', () => {
  it('names both edges of a corner', () => {
    expect(edgesAt(0, SIZE)).toEqual(['Top', 'left']);
    expect(edgesAt(2, SIZE)).toEqual(['Top', 'right']);
    expect(edgesAt(6, SIZE)).toEqual(['Bottom', 'left']);
    expect(edgesAt(8, SIZE)).toEqual(['Bottom', 'right']);
  });

  it('names the one edge of a side cell', () => {
    expect(edgesAt(1, SIZE)).toEqual(['Top']);
    expect(edgesAt(3, SIZE)).toEqual(['left']);
  });

  it('names none in the middle', () => {
    expect(edgesAt(4, SIZE)).toEqual([]);
  });
});

describe('edgeNameAt', () => {
  it('is silent when the move is legal — nothing to explain', () => {
    expect(edgeNameAt(4, SIZE, 'ArrowUp')).toBeNull();
    expect(edgeNameAt(0, SIZE, 'ArrowDown')).toBeNull();
  });

  it('names every edge the cell is against, not only the one it hit', () => {
    // One keypress locates the player absolutely, corner included.
    expect(edgeNameAt(0, SIZE, 'ArrowUp')).toBe('Top left edge');
    expect(edgeNameAt(0, SIZE, 'ArrowLeft')).toBe('Top left edge');
    expect(edgeNameAt(2, SIZE, 'ArrowRight')).toBe('Top right edge');
    expect(edgeNameAt(6, SIZE, 'ArrowDown')).toBe('Bottom left edge');
    expect(edgeNameAt(8, SIZE, 'ArrowRight')).toBe('Bottom right edge');
  });

  it('names a single edge on a side, capitalised as its own phrase', () => {
    expect(edgeNameAt(1, SIZE, 'ArrowUp')).toBe('Top edge');
    expect(edgeNameAt(3, SIZE, 'ArrowLeft')).toBe('Left edge');
    expect(edgeNameAt(5, SIZE, 'ArrowRight')).toBe('Right edge');
    expect(edgeNameAt(7, SIZE, 'ArrowDown')).toBe('Bottom edge');
  });

  it('works on the largest board', () => {
    expect(edgeNameAt(63, 8, 'ArrowRight')).toBe('Bottom right edge');
  });
});
