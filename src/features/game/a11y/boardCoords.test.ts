import { describe, expect, it } from 'vitest';
import {
  chessOf,
  columnLetter,
  coordList,
  coordOf,
  lineName,
  rowColOf,
} from './boardCoords';

const SIZE = 3;

describe('chessOf', () => {
  it('names the column first, then the row, both 1-based', () => {
    expect(chessOf(0, SIZE)).toBe('A1');
    expect(chessOf(4, SIZE)).toBe('B2');
    expect(chessOf(8, SIZE)).toBe('C3');
  });

  it('reads left to right and top to bottom', () => {
    expect(chessOf(2, SIZE)).toBe('C1');
    expect(chessOf(6, SIZE)).toBe('A3');
  });

  it('reaches H on the largest board the server allows', () => {
    expect(chessOf(7, 8)).toBe('H1');
    expect(chessOf(63, 8)).toBe('H8');
  });
});

describe('columnLetter', () => {
  it('falls back to a number past the alphabet it needs', () => {
    // Unreachable at MAX_SIZE 8, but silence would be worse than a digit.
    expect(columnLetter(8)).toBe('9');
  });
});

describe('rowColOf', () => {
  it('keeps the original vocabulary intact', () => {
    expect(rowColOf(4, SIZE)).toBe('R2, C2');
    expect(rowColOf(1, SIZE)).toBe('R1, C2');
  });
});

describe('coordOf', () => {
  it('follows the player’s chosen notation', () => {
    expect(coordOf(4, SIZE, 'chess')).toBe('B2');
    expect(coordOf(4, SIZE, 'rowcol')).toBe('R2, C2');
  });
});

describe('coordList', () => {
  it('comma-joins chess coordinates, which are self-delimiting', () => {
    expect(coordList([3, 4], SIZE, 'chess')).toBe('A2, B2');
  });

  it('breaks row-and-column coordinates into sentences instead', () => {
    // "R1, C2, R2, C2" would be an unreadable run of four parts.
    expect(coordList([1, 4], SIZE, 'rowcol')).toBe('R1, C2. R2, C2');
  });

  it('is empty for an empty list', () => {
    expect(coordList([], SIZE, 'chess')).toBe('');
  });
});

describe('lineName', () => {
  it('names columns by letter under chess notation', () => {
    expect(lineName('col', 1, 'chess')).toBe('Column B');
  });

  it('names them by number otherwise, to match the coordinates around it', () => {
    expect(lineName('col', 1, 'rowcol')).toBe('Column 2');
  });

  it('numbers rows the same either way', () => {
    expect(lineName('row', 1, 'chess')).toBe('Row 2');
    expect(lineName('row', 1, 'rowcol')).toBe('Row 2');
  });

  it('gives the diagonals no index, there being one of each', () => {
    expect(lineName('diag', 0, 'chess')).toBe('Diagonal');
    expect(lineName('anti', 0, 'chess')).toBe('Anti-diagonal');
  });
});
