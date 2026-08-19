import { memo } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui';
import type { SocketStatus } from '../context';

const MESSAGES: Partial<
  Record<SocketStatus, { text: string; detail: string; tone: 'warn' | 'error' }>
> = {
  connecting: {
    text: 'Connecting…',
    detail: 'Reaching the game server.',
    tone: 'warn',
  },
  offline: {
    text: 'Connection lost',
    detail: 'Trying to reconnect. Your seat is held for 60 seconds.',
    tone: 'error',
  },
};

/**
 * Surfaces the socket status, ported from the mobile `ConnectionBanner`.
 *
 * Without it a dropped connection looks exactly like a frozen app: clicks do
 * nothing, no explanation, no indication anything is being retried. The 60
 * seconds it mentions is real — the server holds a disconnected player's seat
 * for exactly that long before handing their opponent a walkover.
 *
 * The live region matters as much as the text: this appears with no user
 * action, so a screen reader has to volunteer it rather than wait to be
 * navigated to.
 */
export const ConnectionBanner = memo(function ConnectionBanner({
  status,
}: {
  status: SocketStatus;
}) {
  const message = MESSAGES[status];
  if (!message) return null;

  const isError = message.tone === 'error';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border p-3',
        isError ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-muted',
      )}>
      {!isError ? <Spinner size="sm" label={null} className="text-foreground" /> : null}
      <div className="flex-1">
        <p
          className={cn(
            'text-sm font-semibold',
            isError ? 'text-destructive' : 'text-foreground',
          )}>
          {message.text}
        </p>
        <p className="text-sm text-muted-foreground">{message.detail}</p>
      </div>
    </div>
  );
});
