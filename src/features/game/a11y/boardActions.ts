import type { Cell, PublicPlayer } from '../types';
import type { Notation } from './boardCoords';
import { describeBoard, describeScores } from './boardReadout';
import { describeNeed, needFor, needThrough, type LineBasis } from './lineProgress';

/**
 * The six things a player can ask the board, and the answers.
 *
 * Ported verbatim from the React Native app: `bingo-react-native/src/features/game/a11y/boardActions.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * **Why one dispatcher for two platforms.** On the web these are keys; on
 * mobile they are screen-reader actions on the focused cell. The *trigger*
 * differs because the devices do, but a player who learns what "row progress"
 * says on one must hear the same sentence on the other — so the wording is
 * decided here, once, and each platform only supplies the trigger.
 *
 * Four of the six are relative to where the cursor is, which is why the cell
 * index is part of the request rather than something the caller resolves first.
 */

/**
 * Which half of the game a readout belongs to.
 *
 * The same keys serve both stages and their functions are deliberately
 * parallel — `R` asks "what is this row missing?" either way — but *missing*
 * means an empty cell while the board is being laid out and an unmarked one
 * once numbers are being called. Carrying the stage in the table is what lets
 * the spoken help and the Settings list describe each key correctly instead of
 * naming keys that do nothing on the screen the player is actually on.
 */
export type BoardStage = 'setup' | 'play';

export type BoardActionName =
  | 'pattern'
  | 'row'
  | 'column'
  | 'diagonal'
  | 'antiDiagonal'
  | 'scores';

export interface BoardActionSpec {
  name: BoardActionName;
  /** Shown in TalkBack's local context menu and VoiceOver's rotor. */
  label: string;
  /** The web key, and how the guide writes it. */
  key: string;
  /** The stages on which this key does anything. */
  stages: BoardStage[];
  /** One sentence, phrased as what it does for the player. */
  description: string;
  /** Overrides `description` during setup, where the question differs. */
  setupDescription?: string;
}

export const BOARD_ACTIONS: BoardActionSpec[] = [
  {
    name: 'pattern',
    label: 'Read whole board',
    key: 'P',
    // Specced for setup only. Kept during play because it is the one way to
    // re-read your own board mid-match, and taking a working readout away is a
    // regression however the table is drawn.
    stages: ['setup', 'play'],
    description: 'Read every row of your board, number by number.',
  },
  {
    name: 'row',
    label: 'Row progress',
    key: 'R',
    stages: ['setup', 'play'],
    description: 'What the row you are on still needs for a strike.',
    setupDescription: 'Which cells in the row you are on are still blank.',
  },
  {
    name: 'column',
    label: 'Column progress',
    key: 'C',
    stages: ['setup', 'play'],
    description: 'What the column you are on still needs for a strike.',
    setupDescription: 'Which cells in the column you are on are still blank.',
  },
  {
    name: 'diagonal',
    label: 'Diagonal progress',
    key: 'D',
    stages: ['setup', 'play'],
    description: 'What the top-left to bottom-right diagonal still needs.',
    setupDescription: 'Which cells on the top-left to bottom-right diagonal are still blank.',
  },
  {
    name: 'antiDiagonal',
    label: 'Anti-diagonal progress',
    key: 'A',
    stages: ['setup', 'play'],
    description: 'What the top-right to bottom-left diagonal still needs.',
    setupDescription: 'Which cells on the top-right to bottom-left diagonal are still blank.',
  },
  {
    name: 'scores',
    label: 'Scores',
    key: 'S',
    // Play only: before the first call every score is zero, and a readout whose
    // answer is always the same teaches the player nothing.
    stages: ['play'],
    description: 'How far everyone is through the target word.',
  },
];

/** What a key does on one stage. */
export function describeAction(spec: BoardActionSpec, stage: BoardStage): string {
  return stage === 'setup' ? spec.setupDescription ?? spec.description : spec.description;
}

/** The actions that do something on this stage. */
export function actionsFor(stage: BoardStage): BoardActionSpec[] {
  return BOARD_ACTIONS.filter(spec => spec.stages.includes(stage));
}

export interface BoardActionContext {
  cells: Cell[];
  size: number;
  /** Where the cursor is. The row and column answers are relative to it. */
  cellIndex: number;
  players: PublicPlayer[];
  myId: string | undefined;
  notation: Notation;
  /**
   * Whether a cell counts as done because it holds a number or because it has
   * been marked. Setup boards are never marked, so asking about marks there
   * answers "needs every cell" on every line — which is true and useless.
   */
  basis?: LineBasis;
}

/**
 * The answer, or null when there is nothing to say.
 *
 * Null only for a board that has not been dealt yet — a readout that invents a
 * reassuring sentence about an absent board is worse than one that stays quiet
 * and lets the caller say "not ready".
 */
export function describeBoardAction(
  action: BoardActionName,
  {
    cells,
    size,
    cellIndex,
    players,
    myId,
    notation,
    basis = 'marked',
  }: BoardActionContext,
): string | null {
  if (action === 'scores') return describeScores(players, size, myId);
  if (cells.length < size * size) return null;
  if (action === 'pattern') return describeBoard(cells, size, notation);

  const need =
    action === 'row'
      ? needThrough(cells, size, cellIndex, 'row', basis)
      : action === 'column'
      ? needThrough(cells, size, cellIndex, 'col', basis)
      : needFor(cells, size, action === 'diagonal' ? 'diag' : 'anti', 0, basis);

  return need ? describeNeed(need, size, notation) : null;
}
