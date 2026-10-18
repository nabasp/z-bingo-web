// Imported from the module rather than the `@/src/lib` barrel on purpose: the
// barrel reaches AudioManager and its native player, which would drag a native
// dependency into what is otherwise pure, directly testable logic.
import { ordinal, plural, sentence } from '@/lib/a11y/phrases';
import type {
  GameDetails,
  GameDetailsPlayer,
  HistoryItem,
  LeaderboardEntry,
  PlayerResult,
} from './history.types';

/**
 * What a history row and a leaderboard row say — to the eye and to the ear.
 *
 * Ported verbatim from the React Native app:
 * `bingo-react-native/src/features/history/historyLabels.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * **Why the spoken form is written separately.** A screen reader reads what
 * it is given, and several of the short forms read badly:
 *
 * - `#A82F` is "number A eighty-two F". Spelled out it is "A 8 2 F".
 * - `1st` is fine on screen and inconsistent aloud; "first place" is not.
 * - `43.8%` is usually fine, but "43.8 percent win rate" leaves no doubt what
 *   the number is.
 * - `4m 12s` is "4 m 12 s" — spelled out it is "4 minutes 12 seconds".
 *
 * Every result is also a *word*. Nothing here depends on colour.
 */

const RESULT_WORD: Record<PlayerResult, string> = {
  won: 'Won',
  lost: 'Lost',
  left: 'Abandoned',
  cancelled: 'Cancelled',
};

/** The result as one word, for both the eye and the ear. */
export function resultWord(result: PlayerResult): string {
  return RESULT_WORD[result];
}

/** `Bingo #A82F` — on screen. */
export function gameTitle(shortId: string): string {
  return `Bingo #${shortId}`;
}

/**
 * `Bingo game A 8 2 F` — aloud.
 *
 * Spaced, so it is read one character at a time rather than as a number with
 * letters attached.
 */
export function gameTitleSpoken(shortId: string): string {
  return `Bingo game ${shortId.split('').join(' ')}`;
}

/** `1st`, `2nd`, `3rd`, `11th`, `22nd`. A dash when there is no place. */
export function rankShort(rank: number | null): string {
  if (rank === null) return '—';
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

/** `first place`, or nothing for a game nobody finished. */
export function rankSpoken(rank: number | null): string | undefined {
  return rank === null ? undefined : `${ordinal(rank)} place`;
}

/** `45s`, `4m 12s`, `1h 3m` — compact, for a list. */
export function durationShort(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/** `4 minutes 12 seconds` — the same span, spelled out. */
export function durationSpoken(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`;
  if (minutes > 0) return `${plural(minutes, 'minute')} ${plural(secs, 'second')}`;
  return plural(secs, 'second');
}

export interface DateOptions {
  /** Injectable so tests do not depend on the machine's time zone. */
  timeZone?: string;
}

/** `Oct 6, 2026`. */
export function dateShort(ms: number, options: DateOptions = {}): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: options.timeZone,
  });
}

/** `October 6, 2026` — the month in full, so nothing has to expand "Oct". */
export function dateSpoken(ms: number, options: DateOptions = {}): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: options.timeZone,
  });
}

/** `8:14 PM`. */
export function timeShort(ms: number, options: DateOptions = {}): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: options.timeZone,
  });
}

/** `43.8%`, or `50%` — no trailing `.0`. */
export function winRatePercent(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

/** `43.8 percent`. */
export function winRateSpoken(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')} percent`;
}

/** `Won · 1st` — the result line of a row. */
export function resultLine(item: Pick<HistoryItem, 'result' | 'rank'>): string {
  return item.rank === null
    ? resultWord(item.result)
    : `${resultWord(item.result)} · ${rankShort(item.rank)}`;
}

export interface HistoryLabelOptions extends DateOptions {
  /**
   * How the game is named at the start of the label.
   *
   * `spoken` (the default) spells the id out — "Bingo game A 8 2 F". `visible`
   * uses the on-screen title, "Bingo #A82F", which the web needs: WCAG 2.5.3
   * requires a link's accessible name to contain its visible text, so a
   * voice-control user can say "click Bingo #A82F" and be understood.
   */
  title?: 'spoken' | 'visible';
}

/**
 * Everything one history row says to a screen reader, in one utterance.
 *
 * Result before detail: "Won, first place" is what the player is listening
 * for, and the date and duration are context for it. The winner is named
 * only when it was someone else — "Winner: you" says nothing "Won" did not.
 */
export function historyItemLabel(item: HistoryItem, options: HistoryLabelOptions = {}): string {
  return sentence(
    options.title === 'visible' ? gameTitle(item.shortId) : gameTitleSpoken(item.shortId),
    [resultWord(item.result), rankSpoken(item.rank)].filter(Boolean).join(', '),
    !item.isWinner && item.winnerName ? `Winner: ${item.winnerName}` : undefined,
    dateSpoken(item.endedAt, options),
    plural(item.playerCount, 'player'),
    item.status === 'completed' ? `Lasted ${durationSpoken(item.durationMs)}` : undefined,
  );
}

/** One player in a game's results, aloud. */
export function detailsPlayerLabel(player: GameDetailsPlayer): string {
  return sentence(
    [rankSpoken(player.rank), player.isYou ? `${player.name}, you` : player.name]
      .filter(Boolean)
      .join(', '),
    resultWord(player.result),
    plural(player.letters, 'letter'),
  );
}

/** The one-line summary at the top of a game's details. */
export function detailsSummary(game: GameDetails): string {
  if (game.status === 'cancelled') {
    return 'This game was cancelled before anyone won.';
  }
  return game.winnerName
    ? `${game.winnerName} won by ${game.endReason === 'walkover' ? 'walkover' : 'completing the word'}.`
    : 'This game finished without a winner.';
}

/**
 * One leaderboard row, aloud.
 *
 * "Rank 1", not "number 1" or "#1": the word says what the number is. The
 * caller's own row says "you" after the name, so finding yourself in a list
 * does not depend on recognising your own display name by ear.
 */
export function leaderboardEntryLabel(entry: LeaderboardEntry): string {
  return sentence(
    `Rank ${entry.rank}`,
    entry.isYou ? `${entry.displayName}, you` : entry.displayName,
    plural(entry.points, 'point'),
    `${plural(entry.gamesPlayed, 'game')}, ${plural(entry.wins, 'win')}`,
    `${winRateSpoken(entry.winRate)} win rate`,
  );
}
