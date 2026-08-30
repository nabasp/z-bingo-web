/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/utils/index.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import type {
  BoardSize,
  Cell,
  LineDescriptor,
  Player,
  PublicPlayer,
} from '../types';
import { ROOM_CODE_PATTERN } from '../constants';

/**
 * Adapt a server player onto the presentation shape the UI components expect,
 * so the Phase 3 components work unchanged against live data.
 */
export function toUiPlayer(
  player: PublicPlayer,
  hostId: string,
  myId: string | undefined,
): Player {
  return {
    id: player.id,
    name: player.name,
    isYou: player.id === myId,
    isHost: player.id === hostId,
    ready: player.ready ? 'ready' : 'not-ready',
    connection: player.connected ? 'connected' : 'disconnected',
    // TODO(livekit): real mic state arrives with voice rooms.
    voice: 'mic-off',
  };
}

/** Build renderable cells from the player's board plus the called numbers. */
export function toCells(
  board: number[] | undefined,
  calledNumbers: number[],
): Cell[] {
  const called = new Set(calledNumbers);
  return (board ?? []).map((value, index) => ({
    index,
    value,
    marked: called.has(value),
  }));
}

/**
 * All 2n+2 winnable lines: n rows, n columns, both diagonals.
 *
 * Mirrors `buildLines` in the server engine (`bingo-node/src/modules/game/
 * game.engine.ts`) — the server stays authoritative for letters and the winner;
 * this exists only so the board can draw a strike over a completed line.
 */
const lineCache = new Map<number, LineDescriptor[]>();

export function buildLines(size: number): LineDescriptor[] {
  // The layout of a board's lines depends only on its size, so build each one
  // once. Previously this allocated 2N+2 descriptors on every snapshot, for
  // both the current and previous board, on every screen that draws strikes.
  // Callers only ever read or filter the result — never mutate it in place.
  const cached = lineCache.get(size);
  if (cached) return cached;

  const lines: LineDescriptor[] = [];

  for (let r = 0; r < size; r++) {
    lines.push({
      type: 'row',
      index: r,
      cells: Array.from({ length: size }, (_, c) => r * size + c),
    });
  }
  for (let c = 0; c < size; c++) {
    lines.push({
      type: 'col',
      index: c,
      cells: Array.from({ length: size }, (_, r) => r * size + c),
    });
  }
  lines.push({
    type: 'diag',
    index: 0,
    cells: Array.from({ length: size }, (_, i) => i * size + i),
  });
  lines.push({
    type: 'anti',
    index: 0,
    cells: Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)),
  });

  lineCache.set(size, lines);
  return lines;
}

/** The lines whose every cell is marked. */
export function completedLines(cells: Cell[], size: number): LineDescriptor[] {
  if (cells.length < size * size) return [];
  const marked = new Set(cells.filter(cell => cell.marked).map(c => c.index));
  return buildLines(size).filter(line =>
    line.cells.every(index => marked.has(index)),
  );
}

/**
 * Normalize typed input to the room-code charset (lowercase letters + hyphen).
 *
 * There is deliberately no client-side code *generator* to go with this. Codes
 * are issued by the server, which is the only place that can guarantee one is
 * unique among active rooms; a local copy of the word lists was dead code whose
 * only real effect was the risk of silently drifting out of sync with the
 * server's. Validation stays here because it is worth catching a typo before a
 * round trip — but the server re-validates regardless.
 */
export function normalizeRoomCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z-]/g, '');
}

/** True when the code is two lowercase words joined by a hyphen. */
export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

/** A shuffled permutation of 1..n² (Fisher–Yates), guaranteeing no repeats. */
export function generatePermutation(size: BoardSize): number[] {
  const count = size * size;
  const nums = Array.from({ length: count }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

/** An empty board of `size²` cells. */
export function makeEmptyBoard(size: BoardSize): Cell[] {
  return Array.from({ length: size * size }, (_, index) => ({
    index,
    value: null,
    marked: false,
  }));
}

/** A board pre-filled with a random permutation of 1..n². */
export function makeFilledBoard(size: BoardSize): Cell[] {
  const perm = generatePermutation(size);
  return perm.map((value, index) => ({ index, value, marked: false }));
}

/** True when every cell has a value. */
export function isBoardComplete(cells: Cell[]): boolean {
  return cells.length > 0 && cells.every(cell => cell.value !== null);
}

/** Split a flat array into rows of length `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/** Up-to-two-letter uppercase initials from a name. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}
