import { Outlet } from 'react-router-dom';
import { useGameFlowNavigation } from '@/features/game/hooks';

/**
 * Wraps every `/game/*` route and mounts the server-driven navigation once.
 *
 * The mobile app calls `useGameFlowNavigation` from each game screen because a
 * native stack has no shared parent that stays mounted across them. A router
 * layout does, so hoisting it here means the rule is stated once and applies
 * everywhere in the flow — including on Create and Join, where it is what moves
 * you into the lobby as soon as the server confirms the room.
 */
export function GameLayout() {
  useGameFlowNavigation();
  return <Outlet />;
}
