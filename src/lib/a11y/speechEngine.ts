import { useSyncExternalStore } from 'react';
import { announcer } from './Announcer';
import type { SpeechSink } from './speechSinks';

/**
 * The app speaking in its own voice, via the Web Speech API.
 *
 * **Why this exists.** Everything spoken so far has gone into an ARIA live
 * region, where the screen reader owns the timing and nothing can be cancelled:
 * `aria-live="assertive"` is a request, and a player arrowing quickly across a
 * board can outrun it. `speechSynthesis.cancel()` is real interruption, and
 * `utterance.onend` is a real completion signal — which also replaces the
 * announcer's 55 ms-per-character guess at how long an utterance takes.
 *
 * It also covers the case the live regions cannot: a keyboard-only player who
 * is not running a screen reader at all, for whom the entire speech layer was
 * previously silent.
 *
 * **Why it is off by default.** A screen-reader user would hear every message
 * twice, in two voices, half a second apart. The two paths are mutually
 * exclusive by construction — installing this sink replaces the live-region
 * one rather than adding to it — and the browser cannot tell us whether a
 * screen reader is running, so the choice has to be the player's.
 */

const STORAGE_KEY = 'bingo.a11y.selfVoice';

let enabled = false;
const listeners = new Set<() => void>();

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

const synthesisSink: SpeechSink = {
  speak(text, { interrupt }) {
    // Always cancel first. Chrome's queue has no length limit and no way to
    // inspect it, so a page that only ever appends ends up minutes behind.
    if (interrupt) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => notifyDone();
    utterance.onerror = () => notifyDone();
    window.speechSynthesis.speak(utterance);
  },
  cancel() {
    window.speechSynthesis.cancel();
  },
  onDone(callback) {
    doneListeners.add(callback);
    return () => {
      doneListeners.delete(callback);
    };
  },
};

const doneListeners = new Set<() => void>();
function notifyDone(): void {
  doneListeners.forEach(listener => listener());
}

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // Private mode, or blocked cookies. Defaults to off.
    return false;
  }
}

function syncSink(): void {
  announcer.setSink(enabled && isSpeechSynthesisSupported() ? synthesisSink : null);
}

/** Restore the saved preference. Call once at startup. */
export function loadSelfVoicePreference(): void {
  enabled = readStored();
  syncSink();
  listeners.forEach(listener => listener());
}

export function setSelfVoiceEnabled(next: boolean): void {
  if (enabled === next) return;
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
  } catch {
    // The switch still works for this session; only the memory of it is lost.
  }
  syncSink();
  listeners.forEach(listener => listener());
}

export function isSelfVoiceEnabled(): boolean {
  return enabled;
}

export function subscribeSelfVoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Live self-voice state, for the settings toggle. */
export function useSelfVoiceEnabled(): boolean {
  return useSyncExternalStore(
    subscribeSelfVoice,
    isSelfVoiceEnabled,
    isSelfVoiceEnabled,
  );
}
