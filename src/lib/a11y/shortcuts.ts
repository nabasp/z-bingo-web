/**
 * Every keyboard shortcut in the app, declared once.
 *
 * The bindings, the spoken announcements and the reference table in Settings
 * all read from here, so what the app does and what it tells you it does
 * cannot drift apart.
 *
 * **Why chords rather than single letters.** `B` and `M` would be simpler to
 * press, but screen readers claim bare letters: in NVDA and JAWS browse mode
 * `B` jumps to the next button, and the keystroke never reaches the page. A
 * chord passes straight through. Since the whole point of this feature is blind
 * and keyboard-only players, a shortcut those users cannot press is not a
 * shortcut.
 */

/**
 * A key combination.
 *
 * `code` exists because of macOS: Option+B emits `key === '∫'` and Option+M
 * `'µ'`, so matching on `key` alone leaves both shortcuts dead on every Mac.
 * `code` is the physical key and is unaffected by the remapping.
 */
export interface Chord {
  /** A `KeyboardEvent.key` value. Compared case-insensitively. */
  key: string;
  /** A `KeyboardEvent.code` value, matched as an alternative to `key`. */
  code?: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface ShortcutSpec {
  chord: Chord;
  /** How it is written down, e.g. in Settings. */
  keys: string;
  /**
   * How it is read aloud. Separate from `keys` because a screen reader renders
   * "Alt + B" as punctuation rather than as a key combination.
   */
  spoken: string;
  /** One sentence, phrased as what it does for the player. */
  description: string;
}

export const SHORTCUTS = {
  focusBoard: {
    chord: { key: 'b', code: 'KeyB', alt: true },
    keys: 'Alt + B',
    spoken: 'Alt plus B',
    description: 'Jump to your board, and back to where you were.',
  },
  toggleMic: {
    chord: { key: 'm', code: 'KeyM', alt: true },
    keys: 'Alt + M',
    spoken: 'Alt plus M',
    description: 'Mute or unmute your microphone.',
  },
  exitGame: {
    chord: { key: 'Escape' },
    keys: 'Escape',
    spoken: 'Escape',
    description: 'Leave the game. Asks you to confirm first.',
  },
} as const satisfies Record<string, ShortcutSpec>;

export type ShortcutName = keyof typeof SHORTCUTS;
