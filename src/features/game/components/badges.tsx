import { memo } from 'react';
import { useMicState } from '@/features/voice/hooks';
import { cn } from '@/lib/cn';
import type { ConnectionStatus, ReadyStatus } from '../types';

/** Amber "HOST" pill. */
export const HostBadge = memo(function HostBadge() {
  return (
    <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-xs font-bold text-neutral-900">
      HOST
    </span>
  );
});

/** Ready / Not Ready pill. */
export const ReadyBadge = memo(function ReadyBadge({ status }: { status: ReadyStatus }) {
  const ready = status === 'ready';
  return (
    <span
      className={cn(
        'rounded-lg px-3 py-1 text-xs font-semibold',
        ready ? 'bg-emerald-400 text-neutral-900' : 'bg-muted text-muted-foreground',
      )}>
      {ready ? 'Ready' : 'Not Ready'}
    </span>
  );
});

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Offline',
};

/**
 * Small text status (connection and microphone), used under a player's name.
 *
 * Takes a `playerId` and reads the microphone itself rather than receiving it
 * as a prop. That keeps the subscription at the leaf: when somebody mutes,
 * this one text node re-renders and the surrounding `PlayerCard` — and the
 * board behind it — do not.
 *
 * Both halves are words. Nothing here is conveyed by colour.
 */
export const StatusBadge = memo(function StatusBadge({
  connection,
  playerId,
}: {
  connection: ConnectionStatus;
  playerId: string;
}) {
  const voice = useMicState(playerId);
  return (
    <span className="text-xs text-muted-foreground">
      {CONNECTION_LABEL[connection]} · {voice === 'mic-on' ? 'Mic On' : 'Mic Off'}
    </span>
  );
});
