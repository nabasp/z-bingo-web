// Imported from the module rather than the `@/lib` barrel on purpose: the
// barrel reaches AudioManager and its native player, which would drag a native
// dependency into what is otherwise pure, directly testable logic.
import { playerName, plural, sentence } from '@/lib/a11y/phrases';
import type { Cell, CallRecord, PublicPlayer } from '../types';
import { coordOf, lineName, type Notation } from './boardCoords';

/**
 * The two on-demand summaries: the whole board, and everyone's progress.
 *
 * Ported verbatim from the React Native app: `bingo-react-native/src/features/game/a11y/boardReadout.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * These are the only strings in the app that are *asked for* rather than
 * pushed, which changes the rules: they can be long, because the player chose
 * to hear them and can interrupt with any other key. Everything else in the
 * speech layer is trimmed on the assumption nobody opted in.
 */

/**
 * Every row, in order. `"Row 1: 1, 2, 4. Row 2: 5, 9, 6."`
 *
 * A cell with no number reads "blank", the same word the cursor uses for one.
 *
 * Rows rather than a flat run of numbers because the row breaks are the only
 * thing that makes the arrangement memorable; a listener can hold three rows of
 * three, not nine numbers. On an 8×8 this is 64 numbers and will be well past
 * the announcer's batch cap, which is what `allowLong` exists for.
 */
export function describeBoard(
  cells: Cell[],
  size: number,
  notation: Notation,
): string {
  const rows: string[] = [];
  for (let row = 0; row < size; row++) {
    const values = cells
      .slice(row * size, row * size + size)
      .map(cell => (cell.value === null ? 'blank' : String(cell.value)));
    rows.push(`${lineName('row', row, notation)}: ${values.join(', ')}`);
  }
  return `${rows.join('. ')}.`;
}

/**
 * Where everybody is against the target word.
 *
 * `letters` is the server's own count of completed lines, capped at the board
 * size, and the word is always exactly as long as the board is wide — so
 * "2 of 3" is both the letters earned and the lines completed, and needs no
 * second number. Seat order, not rank: the standings only exist at the end, and
 * re-sorting a list a player is learning by position would make it harder to
 * follow, not easier.
 */
export function describeScores(
  players: PublicPlayer[],
  size: number,
  myId: string | undefined,
): string {
  if (players.length === 0) return 'No players yet.';
  const parts = players
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map(player => {
      const who = playerName(player.name, player.id === myId);
      const verb = player.id === myId ? 'are' : 'is';
      return `${who} ${verb} ${player.letters} of ${size}`;
    });
  return `${parts.join('. ')}.`;
}

export interface LastCallOptions {
  /** The most recent entry in the room's call history, if there is one. */
  call: CallRecord | undefined;
  players: PublicPlayer[];
  /** Your own board, for the coordinate. */
  cells: Cell[];
  size: number;
  myId: string | undefined;
  notation: Notation;
}

/**
 * The call you just missed. `"Last call: B2, 25, called by John."`
 *
 * Worded like the live announcement — cell first, then the number, then who —
 * so the two are learned once. **"Last call" is not decoration.** Without it a
 * replay is indistinguishable from a number being called this instant, which
 * on a timed turn is the difference between acting and losing your turn.
 *
 * A number that is not on your board has no coordinate, and one is not
 * invented: the cell is simply left out, exactly as in the live sentence.
 */
export function describeLastCall({
  call,
  players,
  cells,
  size,
  myId,
  notation,
}: LastCallOptions): string {
  if (!call) return 'Nothing has been called yet.';

  const caller = players.find(player => player.id === call.playerId);
  // Lowercase "you" here, unlike the scores readout: this one reads as prose
  // mid-sentence rather than as a name at the head of one.
  const who =
    call.playerId === myId ? 'you' : caller?.name ?? 'Someone';
  const index = cells.findIndex(cell => cell.value === call.number);
  const where = index >= 0 ? `${coordOf(index, size, notation)}, ` : '';

  return `Last call: ${sentence(
    `${where}${call.number}, called by ${who}`,
    index >= 0 ? undefined : 'Not on your board',
  )}.`;
}

/** `"Game started. 3 players: Nimmy, John and you. Target word BUS."` */
export function describePlayerCount(count: number): string {
  return plural(count, 'player');
}
