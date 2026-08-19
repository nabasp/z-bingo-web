import { useSyncExternalStore } from 'react';

/**
 * Semantic haptics for game events — the web counterpart of
 * `bingo/src/lib/a11y/haptics.ts`.
 *
 * Callers name the *event*, never a waveform, so the feel of the game can be
 * retuned in one place. `react-native-haptic-feedback` becomes the Vibration
 * API, which exists on Android browsers and is absent on desktop and iOS
 * Safari — where every call below is a silent no-op, exactly as the native
 * version is on a device with no haptic motor.
 */

export type HapticEvent =
  | 'cellMarked'
  | 'lineComplete'
  | 'invalid'
  | 'turnStart'
  | 'win'
  | 'lose';

/**
 * Vibration patterns, in ms (`[buzz, pause, buzz, …]`).
 *
 * Chosen to echo the native mapping: a single short tap for confirmations, a
 * rising double for success, a long-short for a rejection.
 */
const PATTERNS: Record<HapticEvent, number | number[]> = {
  cellMarked: 20, // impactMedium
  lineComplete: [15, 60, 30], // notificationSuccess
  invalid: [40, 50, 40], // notificationWarning
  turnStart: 10, // impactLight
  win: [20, 60, 20, 60, 60], // notificationSuccess, celebratory
  lose: [60, 80, 60], // notificationError
};

const STORAGE_KEY = 'bingo.haptics.enabled';

let enabled = true;
const listeners = new Set<() => void>();

function supported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Restore the saved preference. Call once at startup. */
export function loadHapticsPreference(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      enabled = raw === 'true';
      listeners.forEach(listener => listener());
    }
  } catch {
    // Defaults to on; a storage failure is not worth surfacing.
  }
}

/** Global off switch, driven by the settings screen. */
export function setHapticsEnabled(next: boolean): void {
  if (enabled === next) return;
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
  } catch {
    // Non-fatal.
  }
  listeners.forEach(listener => listener());
}

export function areHapticsEnabled(): boolean {
  return enabled;
}

/** False on desktop and iOS Safari — the settings row says so rather than lying. */
export function areHapticsSupported(): boolean {
  return supported();
}

export function subscribeHaptics(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Live haptics state, for the settings toggle. */
export function useHapticsEnabled(): boolean {
  return useSyncExternalStore(
    subscribeHaptics,
    areHapticsEnabled,
    areHapticsEnabled,
  );
}

/**
 * Fire a haptic. Haptics are useful to sighted players too, and are the one
 * feedback channel that still works when speech and game audio are already
 * competing — so this is never gated on screen-reader state.
 */
export function haptic(event: HapticEvent): void {
  if (!enabled || !supported()) return;
  try {
    navigator.vibrate(PATTERNS[event]);
  } catch {
    // A denied permission or a hostile browser must never break gameplay.
  }
}
