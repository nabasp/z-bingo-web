import { memo, type Ref } from 'react';
import { Link } from 'react-router-dom';
import { gameDetailsPath } from '@/routes/paths';
import {
  dateShort,
  durationShort,
  gameTitle,
  historyItemLabel,
  resultLine,
} from '../historyLabels';
import type { HistoryItem, PlayerResult } from '../history.types';

/**
 * A tint for the result word — never the only signal. The word itself is
 * always on screen and always in the link's name.
 */
const RESULT_TINT: Record<PlayerResult, string> = {
  won: 'text-emerald-400',
  lost: 'text-rose-400',
  left: 'text-amber-400',
  cancelled: 'text-muted-foreground',
};

export interface HistoryRowProps {
  item: HistoryItem;
  /** Lets a list move focus here after loading the page this row is on. */
  linkRef?: Ref<HTMLAnchorElement>;
}

/**
 * One game in a player's history: a link to its results.
 *
 * The link's name is one sentence, result first, held in visually hidden text;
 * the visible layout is hidden from assistive technology so it is not read a
 * second time in fragments. The sentence starts with the visible title —
 * "Bingo #A82F" — because WCAG 2.5.3 requires a link's name to contain what it
 * visibly says, which is what lets a voice-control user click it by name.
 */
export const HistoryRow = memo(function HistoryRowView({ item, linkRef }: HistoryRowProps) {
  return (
    <li>
      <Link
        ref={linkRef}
        to={gameDetailsPath(item.id)}
        className="block w-full rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-card/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="sr-only">{historyItemLabel(item, { title: 'visible' })}</span>
        <span aria-hidden="true" className="flex items-start justify-between gap-4">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-semibold text-foreground">
              {gameTitle(item.shortId)}
            </span>
            <span className="text-sm text-muted-foreground">
              {dateShort(item.endedAt)} · {item.playerCount} players · {item.size}×{item.size}
            </span>
            {!item.isWinner && item.winnerName ? (
              <span className="text-sm text-muted-foreground">Winner: {item.winnerName}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className={`text-sm font-semibold ${RESULT_TINT[item.result]}`}>
              {resultLine(item)}
            </span>
            {item.status === 'completed' ? (
              <span className="text-xs text-muted-foreground">
                {durationShort(item.durationMs)}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
});
