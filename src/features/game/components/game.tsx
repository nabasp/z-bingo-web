import { memo } from 'react';
import { cn } from '@/lib/cn';
import { SectionLabel } from '@/components/ui';
import { plural, sentence } from '@/lib/a11y/phrases';
import type { Announcement, PlayerProgress } from '../types';
import { WARNING_WINDOW_SECONDS } from '../audio/turnWarning';
import { DEFAULT_TURN_SECONDS } from '../constants';
import { PlayerAvatar } from './PlayerAvatar';

/** Whose turn it is, the turn counter, and the countdown to the deadline. */
export const TurnBanner = memo(function TurnBanner({
  byName,
  turn,
  seatIndex = 1,
  secondsLeft,
  totalSeconds = DEFAULT_TURN_SECONDS,
}: {
  /** Possessive form, e.g. "Your" or "Alex's". */
  byName: string;
  turn: number;
  seatIndex?: number;
  secondsLeft?: number;
  /** The room's turn length — turns are 1–5 minutes, chosen by the host. */
  totalSeconds?: number;
}) {
  // A turn length of zero means the mode is untimed — Play With Bot, which
  // arms no deadline. "Calling a number…" is the *waiting for the clock*
  // wording, and left standing there forever it just reads as stuck.
  const untimed = totalSeconds === 0;
  // Turns red exactly when the warning audio starts, so the two urgency cues
  // never disagree.
  const urgent = secondsLeft !== undefined && secondsLeft <= WARNING_WINDOW_SECONDS;
  const remainingFraction =
    secondsLeft === undefined ? 1 : Math.min(1, Math.max(0, secondsLeft / totalSeconds));

  return (
    <div
      // The remaining time is deliberately not in the label. Urgency is carried
      // by the accelerating warning audio instead; a countdown read aloud is
      // slow to hear and stale by the time it finishes. The seconds stay on
      // screen. No live region either: this re-renders once a second, and a
      // live region would re-speak the whole banner every tick.
      aria-label={sentence(`${byName} turn`, `Turn ${turn}`)}
      className="w-full rounded-2xl border border-border bg-card px-4 py-3.5">
      <div aria-hidden="true" className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PlayerAvatar name={byName} seatIndex={seatIndex} size="sm" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {byName} turn
            </span>
            <span className="text-xs text-muted-foreground">
              {secondsLeft !== undefined
                ? `${secondsLeft}s to call`
                : untimed
                  ? 'No time limit'
                  : 'Calling a number…'}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-xs font-medium text-muted-foreground">Turn {turn}</span>
          {secondsLeft !== undefined ? (
            <span
              className={cn(
                'text-sm font-bold',
                urgent ? 'text-rose-400' : 'text-foreground',
              )}>
              {secondsLeft}s
            </span>
          ) : null}
        </div>
      </div>

      {secondsLeft !== undefined ? (
        <div
          aria-hidden="true"
          className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full',
              urgent ? 'bg-rose-400' : 'bg-primary',
            )}
            style={{ width: `${remainingFraction * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  );
});

/** The most recent called number, highlighted. */
export const AnnouncementCard = memo(function AnnouncementCard({
  announcement,
}: {
  announcement: Announcement;
}) {
  return (
    <div
      aria-label={`${announcement.byName} called ${announcement.number}. ${announcement.message}`}
      className="w-full rounded-2xl bg-primary px-4 py-3.5">
      <div aria-hidden="true" className="flex items-center gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-lg font-bold text-primary">
          {announcement.number}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-primary-foreground">
            {announcement.byName} called {announcement.number}
          </span>
          {/* Measured 3.35:1 as neutral-900/50 in the mobile app — below AA.
              This is 9.1:1. */}
          <span className="text-xs text-primary-foreground/80">
            {announcement.message}
          </span>
        </span>
      </div>
    </div>
  );
});

/** How many recent calls to read out before summarising the rest. */
const SPOKEN_RECENT_LIMIT = 8;

/**
 * How many chips to render.
 *
 * The strip grows to N² entries — 64 on an 8×8 — which pushed the rest of the
 * mobile screen off. The full history is still in the label summary and on the
 * result page.
 */
const VISIBLE_RECENT_LIMIT = 12;

/** Horizontal strip of recently called numbers (newest first, highlighted). */
export const RecentNumbers = memo(function RecentNumbers({
  numbers,
}: {
  numbers: number[];
}) {
  const spoken =
    numbers.length === 0
      ? 'Recent calls. None yet.'
      : sentence(
          `Recent calls, newest first: ${numbers.slice(0, SPOKEN_RECENT_LIMIT).join(', ')}`,
          numbers.length > SPOKEN_RECENT_LIMIT
            ? `and ${numbers.length - SPOKEN_RECENT_LIMIT} more`
            : undefined,
        );

  return (
    // One node, not one per chip: this strip grows to N² entries, which would
    // put up to 64 single-number stops between the board and everything else.
    // The summary caps what is read out.
    <section aria-label={spoken} className="flex w-full flex-col gap-2">
      <SectionLabel aria-hidden="true">Recent calls</SectionLabel>
      <div aria-hidden="true" className="no-scrollbar flex gap-2 overflow-x-auto">
        {numbers.slice(0, VISIBLE_RECENT_LIMIT).map((n, i) => (
          <span
            key={`${n}-${i}`}
            className={cn(
              'flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl px-2 text-base font-bold',
              i === 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground',
            )}>
            {n}
          </span>
        ))}
        {numbers.length > VISIBLE_RECENT_LIMIT ? (
          <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-card px-2 text-sm font-semibold text-muted-foreground">
            +{numbers.length - VISIBLE_RECENT_LIMIT}
          </span>
        ) : null}
      </div>
    </section>
  );
});

/** Per-player match progress (lines completed / target). */
export const PlayerProgressRow = memo(function PlayerProgressRow({
  progress,
}: {
  progress: PlayerProgress[];
}) {
  return (
    <section className="flex w-full flex-col gap-2" aria-label="Progress">
      <SectionLabel aria-hidden="true">Progress</SectionLabel>
      <ul className="flex list-none gap-2 p-0">
        {progress.map((p, i) => (
          <li
            key={p.playerId}
            aria-label={`${p.name}, ${plural(p.matched, 'line')} of ${p.target}`}
            className="flex flex-1 items-center gap-2 rounded-xl bg-card p-3">
            <PlayerAvatar name={p.name} seatIndex={i} size="sm" />
            <span aria-hidden="true" className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold text-foreground">
                {p.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {p.matched}/{p.target}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
});
