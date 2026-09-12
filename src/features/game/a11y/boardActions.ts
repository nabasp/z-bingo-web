import type { Cell, PublicPlayer } from '../types';
import type { Notation } from './boardCoords';
import { describeBoard, describeScores } from './boardReadout';
import { describeNeed, needFor, needThrough } from './lineProgress';

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
  /** One sentence, phrased as what it does for the player. */
  description: string;
}

export const BOARD_ACTIONS: BoardActionSpec[] = [
  {
    name: 'pattern',
    label: 'Read whole board',
    key: 'P',
    description: 'Read every row of your board, number by number.',
  },
  {
    name: 'row',
    label: 'Row progress',
    key: 'R',
    description: 'What the row you are on still needs.',
  },
  {
    name: 'column',
    label: 'Column progress',
    key: 'C',
    description: 'What the column you are on still needs.',
  },
  {
    name: 'diagonal',
    label: 'Diagonal progress',
    key: 'D',
    description: 'What the top-left to bottom-right diagonal still needs.',
  },
  {
    name: 'antiDiagonal',
    label: 'Anti-diagonal progress',
    key: 'X',
    description: 'What the top-right to bottom-left diagonal still needs.',
  },
  {
    name: 'scores',
    label: 'Scores',
    key: 'S',
    description: 'How far everyone is through the target word.',
  },
];

export interface BoardActionContext {
  cells: Cell[];
  size: number;
  /** Where the cursor is. The row and column answers are relative to it. */
  cellIndex: number;
  players: PublicPlayer[];
  myId: string | undefined;
  notation: Notation;
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
  { cells, size, cellIndex, players, myId, notation }: BoardActionContext,
): string | null {
  if (action === 'scores') return describeScores(players, size, myId);
  if (cells.length < size * size) return null;
  if (action === 'pattern') return describeBoard(cells, size, notation);

  const need =
    action === 'row'
      ? needThrough(cells, size, cellIndex, 'row')
      : action === 'column'
      ? needThrough(cells, size, cellIndex, 'col')
      : needFor(cells, size, action === 'diagonal' ? 'diag' : 'anti', 0);

  return need ? describeNeed(need, size, notation) : null;
}
