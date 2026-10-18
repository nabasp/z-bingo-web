import { BOARD_ACTIONS, type BoardStage } from '@/features/game/a11y/boardActions';

export type { BoardStage };

/**
 * Every keyboard shortcut in the app, declared once.
 *
 * The bindings, the spoken announcements and the reference table in Settings
 * all read from here, so what the app does and what it tells you it does
 * cannot drift apart.
 *
 * **Why some are chords and some are bare letters.** Both, for the same reason:
 * NVDA and JAWS reserve bare letters in *browse* mode, where `B` jumps to the
 * next button, `H` to the next heading, and the keystroke never reaches the
 * page. So a shortcut that must work anywhere — jump to the board, mute the
 * mic — is a chord, which passes straight through.
 *
 * Inside the board that reservation does not apply. `role="grid"` with
 * focusable `gridcell`s puts both screen readers into *focus* mode, where every
 * key is handed to the page, and the grid's own `keydown` handler consumes
 * these before they reach anything else. That is what makes `P`, `R`, `C`, `D`,
 * `A`, `S`, `F`, `U` and `H` safe there and nowhere else — and the board is the
 * only place their answers mean anything anyway, since most of them are
 * relative to the cell you are on.
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
  /** The stages on which this chord is actually bound. */
  stages: readonly BoardStage[];
}

export const SHORTCUTS = {
  focusBoard: {
    chord: { key: 'b', code: 'KeyB', alt: true },
    keys: 'Alt + B',
    spoken: 'Alt plus B',
    description: 'Jump to your board, and back to where you were.',
    stages: ['setup', 'play'],
  },
  toggleMic: {
    chord: { key: 'm', code: 'KeyM', alt: true },
    keys: 'Alt + M',
    spoken: 'Alt plus M',
    description: 'Mute or unmute your microphone.',
    stages: ['setup', 'play'],
  },
  exitGame: {
    chord: { key: 'Escape' },
    keys: 'Escape',
    spoken: 'Escape',
    description: 'Leave the game. Asks you to confirm first.',
    // Bound by the game board only. Setup deliberately has no Escape, so
    // listing it there would advertise a key that does nothing.
    stages: ['play'],
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
  /** The stages on which this key does something. */
  stages: readonly BoardStage[];
  /** Overrides `description` during setup, where the question differs. */
  setupDescription?: string;
}

export const BOARD_KEYS: BoardKeySpec[] = [
  ...BOARD_ACTIONS.map(action => ({
    key: action.key,
    keys: action.key,
    spoken: action.key,
    description: action.description,
    setupDescription: action.setupDescription,
    stages: action.stages,
  })),
  {
    key: 'B',
    keys: 'B',
    spoken: 'B',
    description: 'Jump to the top-left cell.',
    stages: ['setup', 'play'],
  },
  {
    key: 'M',
    keys: 'M',
    spoken: 'M',
    description: 'Mute or unmute your microphone.',
    stages: ['setup', 'play'],
  },
  {
    key: 'F',
    keys: 'F',
    spoken: 'F',
    description: 'Fill the cells you have not chosen yet, at random.',
    stages: ['setup'],
  },
  {
    key: 'U',
    keys: 'U',
    spoken: 'U',
    description: 'Undo the last change to your board.',
    stages: ['setup'],
  },
  {
    key: 'H',
    keys: 'H',
    spoken: 'H',
    description: 'Read every shortcut out, and what it does.',
    stages: ['setup', 'play'],
  },
];

/** What a board key does on one stage. */
export function describeBoardKey(spec: BoardKeySpec, stage: BoardStage): string {
  return stage === 'setup' ? spec.setupDescription ?? spec.description : spec.description;
}

/**
 * One key, written for both stages at once.
 *
 * For Settings and the guide, which describe the keys away from any particular
 * screen and so cannot pick a stage. Reading `stages` here is what keeps them
 * from advertising a key on a screen that does not answer it.
 */
export function describeBoardKeyForReference(spec: BoardKeySpec): string {
  const setup = spec.stages.includes('setup')
    ? describeBoardKey(spec, 'setup')
    : null;
  const play = spec.stages.includes('play') ? describeBoardKey(spec, 'play') : null;

  if (setup && play) {
    return setup === play ? setup : `Setting up: ${setup} Playing: ${play}`;
  }
  if (setup) return `While you are setting your board up only. ${setup}`;
  return `During a game only. ${play}`;
}

/** The board keys that do something on this stage. */
export function boardKeysFor(stage: BoardStage): BoardKeySpec[] {
  return BOARD_KEYS.filter(spec => spec.stages.includes(stage));
}

/** The global chords bound on this stage. */
export function shortcutsFor(stage: BoardStage): ShortcutSpec[] {
  // `as const` narrows each entry's `stages` to its own literal tuple, so the
  // widening is what lets one predicate serve all three.
  return Object.values(SHORTCUTS).filter(spec =>
    (spec.stages as readonly BoardStage[]).includes(stage),
  );
}

/**
 * Spoken by `H`, and shown in the guide.
 *
 * Both tables, not just the board keys: `H` is asked to read out *every*
 * shortcut, and the chords were otherwise spoken only once, in the arrival
 * announcement, which is no help to anyone who has forgotten one mid-game.
 * Filtered by stage so it can never advertise a key this screen does not bind.
 */
export function describeShortcuts(stage: BoardStage): string {
  const chords = shortcutsFor(stage).map(
    spec => `${spec.spoken}. ${spec.description}`,
  );
  const keys = boardKeysFor(stage).map(
    spec => `${spec.spoken}. ${describeBoardKey(spec, stage)}`,
  );
  return [
    'Anywhere on this screen:',
    ...chords,
    'On the board:',
    'Arrow keys. Move one cell.',
    stage === 'setup'
      ? 'Enter. Put the next number in this cell, or take it out again.'
      : 'Enter. Call this number.',
    ...keys,
  ].join(' ');
}
