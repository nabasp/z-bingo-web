import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import { useGameSocket } from '../context';

/**
 * Drive routing from the server's room status.
 *
 * Ported from `bingo/src/features/game/hooks/useGameFlowNavigation.ts`, and the
 * reason it exists is unchanged: the server owns the phase, so pages are never
 * pushed manually mid-game. Whenever `status` changes — including after a
 * reconnect — we land on the right page, which is also what lets a rejoining
 * player resume exactly where they were.
 *
 * `replace` rather than `push`: these transitions are not places the player
 * chose to go, so stacking them in history would make Back walk through a game
 * they already finished.
 */
export function useGameFlowNavigation(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { room, me } = useGameSocket();
  const lastPath = useRef<string | null>(null);

  const status = room?.status;
  const submitted = me?.ready ?? false;

  useEffect(() => {
    if (!room || !status) return;

    let target: string;
    switch (status) {
      case 'lobby':
        target = PATHS.lobby;
        break;
      case 'setup':
        // Once your board is in, wait for everyone else.
        target = submitted ? PATHS.waiting : PATHS.boardSetup;
        break;
      case 'playing':
        target = PATHS.play;
        break;
      case 'finished':
        target = PATHS.result;
        break;
      default:
        return;
    }

    // The ref guard is what the mobile version uses to avoid re-navigating on
    // every snapshot; the pathname check additionally covers a manual URL edit
    // or a refresh, where the ref starts empty but we are already in place.
    if (lastPath.current === target && pathname === target) return;
    lastPath.current = target;
    if (pathname === target) return;

    navigate(target, { replace: true });
  }, [room, status, submitted, pathname, navigate]);
}
