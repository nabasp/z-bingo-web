import { Outlet } from 'react-router-dom';
import { useGameFlowNavigation } from '@/features/game/hooks';
import { useMicShortcut, VoiceProvider } from '@/features/voice';

/**
 * Binds Alt+M for the whole game flow.
 *
 * A child rather than a call in `GameLayout` itself: the layout *renders* the
 * provider, so it sits outside the context and cannot read it. Renders nothing.
 */
function VoiceShortcuts() {
  useMicShortcut();
  return null;
}

/**
 * Wraps every `/game/*` route and mounts the server-driven navigation once.
 *
 * The mobile app calls `useGameFlowNavigation` from each game screen because a
 * native stack has no shared parent that stays mounted across them. A router
 * layout does, so hoisting it here means the rule is stated once and applies
 * everywhere in the flow — including on Create and Join, where it is what moves
 * you into the lobby as soon as the server confirms the room.
 *
 * It is also where voice chat lives, for the same reason: this component
 * unmounts the moment the player leaves the game flow, which is exactly when
 * their audio connection should end. Mounting it any higher — beside
 * GameSocketProvider in App — would leave the call running after the game.
 */
export function GameLayout() {
  useGameFlowNavigation();
  return (
    <VoiceProvider>
      <VoiceShortcuts />
      <Outlet />
    </VoiceProvider>
  );
}
