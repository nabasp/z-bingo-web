import { useEffect, useState } from 'react';
import { startTurnWarning } from '../audio/turnWarning';
import { TurnBanner } from './game';

/** Seconds remaining on the current turn, or null when there's no deadline. */
function useCountdown(endsAt: number | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/**
 * Run the accelerating warning over the tail of your own turn.
 *
 * Only on your turn: the timeout only costs *you* anything, and ticking through
 * every opponent's turn would be relentless. `turn_timeout` takes over at zero,
 * from the snapshot diff.
 *
 * Keyed on `turnEndsAt` rather than the once-a-second `secondsLeft`, because the
 * warning ticks faster than 1 Hz near the end.
 */
function useTurnCountdownFeedback(turnEndsAt: number | undefined, isMyTurn: boolean) {
  useEffect(() => {
    if (!isMyTurn || !turnEndsAt) return;
    return startTurnWarning(turnEndsAt);
  }, [turnEndsAt, isMyTurn]);
}

export interface LiveTurnBannerProps {
  byName: string;
  turn: number;
  turnEndsAt?: number;
  /** The room's configured turn length, for the progress bar. */
  turnSeconds: number;
  isMyTurn: boolean;
}

/**
 * The turn banner, plus the one-second timer that drives it.
 *
 * **This component exists for performance.** The countdown sets state every
 * second; owning that state here keeps the re-render confined to this leaf.
 * When the timer lived in the game screen it re-rendered the whole screen once
 * a second — including all N² board cells — which is both wasted work and, with
 * a screen reader running, a way to lose focus mid-turn.
 */
export function LiveTurnBanner({
  byName,
  turn,
  turnEndsAt,
  turnSeconds,
  isMyTurn,
}: LiveTurnBannerProps) {
  const secondsLeft = useCountdown(turnEndsAt);
  useTurnCountdownFeedback(turnEndsAt, isMyTurn);

  return (
    <TurnBanner
      byName={byName}
      turn={turn}
      secondsLeft={secondsLeft ?? undefined}
      totalSeconds={turnSeconds}
    />
  );
}
