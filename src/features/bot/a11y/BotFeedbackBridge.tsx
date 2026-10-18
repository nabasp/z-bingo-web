import { useSnapshotFeedback } from '@/features/game/hooks/useGameFeedback';
import type { RoomSnapshot } from '@/features/game/types';

/**
 * Sound, speech and haptics for a bot game.
 *
 * The multiplayer bridge in `App.tsx` sits beside the navigator rather than
 * above it, so nothing mounted inside a screen can shadow what it reads — it
 * would go on watching a socket room that, during a bot game, is null. This
 * mounts the same feedback against the local snapshot instead.
 *
 * `turnChangeReason` is always null here: that field exists so the client stops
 * guessing why the server moved a turn, and locally there is no guessing to do —
 * the diff sees the call that caused it.
 */
export function BotFeedbackBridge({
  room,
  myId,
}: {
  room: RoomSnapshot;
  myId: string;
}): null {
  useSnapshotFeedback(room, null, myId);
  return null;
}
