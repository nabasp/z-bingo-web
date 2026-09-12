import { BOARD_ACTIONS } from '@/features/game/a11y/boardActions';

/**
 * Every keyboard shortcut in the app, declared once.
 *
 * The bindings, the spoken announcements and the reference table in Settings
 * all read from here, so what the app does and what it tells you it does
 * cannot drift apart.
 *
 * **Why some are chords and some are bare letters.** Both, for the same reason:
 * NVDA and JAWS reserve bare letters in *browse* mode, where `B` jumps to the
 * next button and the keystroke never reaches the page. So a shortcut that must
 * work anywhere — jump to the board, mute the mic — is a chord, which passes
 * straight through.
 *
 * Inside the board that reservation does not apply. `role="grid"` with
 * focusable `gridcell`s puts both screen readers into *focus* mode, where every
 * key is handed to the page, and the grid's own `keydown` handler consumes
 * these before they reach anything else. That is what makes `P`, `R`, `C`, `D`,
 * `X` and `S` safe there and nowhere else — and the board is the only place
 * their answers mean anything anyway, since four of the six are relative to the
 * cell you are on.
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

/**
 * The keys the board grid handles itself, while it has focus.
 *
 * Single letters, deliberately — see the note at the top. They are listed
 * separately from `SHORTCUTS` because they are not global bindings and
 * `useShortcut` must never be given one: a bare `R` registered on `document`
 * would fire while the player was reading the page with a screen reader.
 */
export interface BoardKeySpec {
  /** Matched case-insensitively against `KeyboardEvent.key`. */
  key: string;
  keys: string;
  spoken: string;
  description: string;
}

export const BOARD_KEYS: BoardKeySpec[] = [
  ...BOARD_ACTIONS.map(action => ({
    key: action.key,
    keys: action.key,
    spoken: action.key,
    description: action.description,
  })),
  {
    key: 'B',
    keys: 'B',
    spoken: 'B',
    description: 'Jump to A1, the top-left cell.',
  },
  {
    key: 'M',
    keys: 'M',
    spoken: 'M',
    description: 'Mute or unmute your microphone.',
  },
  {
    key: '?',
    keys: '?',
    spoken: 'question mark',
    description: 'Read this list of keys out.',
  },
];

/** Spoken by the `?` key, and shown in the guide. */
export function describeBoardKeys(): string {
  return BOARD_KEYS.map(spec => `${spec.spoken}. ${spec.description}`).join(' ');
}
