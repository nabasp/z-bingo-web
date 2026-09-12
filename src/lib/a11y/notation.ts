import { useSyncExternalStore } from 'react';
import type { Notation } from '@/features/game/a11y/boardCoords';

/**
 * Which coordinate vocabulary the board is read in.
 *
 * Chess by default: `B2` is shorter than `R2, C2`, and it is the form that
 * survives being read back in a list — "needs B1, B2" against "needs R1, C2,
 * R2, C2". The older form stays available because it is unambiguous about
 * which axis is which, which is worth more to a player meeting the board for
 * the first time than the two syllables it costs.
 *
 * A module-level store rather than context: the pure label and readout
 * functions take the value as an argument, and the board needs to read it
 * without putting a subscription inside `BoardCell`'s `memo` boundary.
 *
 * The mobile app keeps the same store at
 * `bingo-react-native/src/lib/a11y/notation.ts`, over AsyncStorage.
 */

const STORAGE_KEY = 'bingo.a11y.notation';

let notation: Notation = 'chess';
const listeners = new Set<() => void>();

/** Restore the saved preference. Call once at startup. */
export function loadNotationPreference(): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'chess' || raw === 'rowcol') notation = raw;
  } catch {
    // Private mode, or blocked cookies. Defaults to chess.
  }
  listeners.forEach(listener => listener());
}

export function setNotation(next: Notation): void {
  if (notation === next) return;
  notation = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The switch still works for this session; only the memory of it is lost.
  }
  listeners.forEach(listener => listener());
}

/** Imperative read, for the readout handlers outside React. */
export function getNotation(): Notation {
  return notation;
}

export function subscribeNotation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the board when the player switches vocabulary. */
export function useNotation(): Notation {
  return useSyncExternalStore(subscribeNotation, getNotation, getNotation);
}
