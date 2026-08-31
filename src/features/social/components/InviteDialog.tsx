import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { announcer } from '@/lib/a11y/Announcer';
import { plural, sentence } from '@/lib/a11y/phrases';
import type { GameInvitePayload } from '../types';
import { userLabel } from '../a11y/socialSpeechEvents';

export interface InviteDialogProps {
  invite: GameInvitePayload | null;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}

/** Seconds left, floored at zero. */
function secondsLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

/**
 * Announce the remaining time only at these marks.
 *
 * A per-second countdown read aloud would make the dialog unusable: the screen
 * reader would talk continuously over the player deciding. These are the
 * points where the number actually changes the decision.
 */
const ANNOUNCE_AT = new Set([60, 30, 10]);

/**
 * An incoming game invitation.
 *
 * Built on native `<dialog showModal()>` for the same reasons as
 * `ConfirmDialog`: a real focus trap, an inert background a screen reader
 * cannot wander into, Escape-to-dismiss and focus restoration on close — all
 * correct, none of it reimplemented.
 *
 * Declining is the safe default, so Escape and the backdrop both decline
 * rather than silently dismissing an invitation the sender is waiting on.
 */
export function InviteDialog({
  invite,
  onAccept,
  onDecline,
  busy = false,
}: InviteDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const [remaining, setRemaining] = useState(0);

  const open = invite !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const onCancel = (event: Event) => {
      // Prevent the default close so declining goes through one path, which
      // also tells the sender rather than leaving them waiting.
      event.preventDefault();
      onDecline();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [onDecline]);

  // Accept is the affirmative action and the one most players want, so focus
  // lands there — but Escape still declines, so nothing is accepted by reflex.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => acceptRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open, invite?.id]);

  useEffect(() => {
    if (!invite) return;

    const tick = () => {
      const left = secondsLeft(invite.expiresAt);
      setRemaining(left);
      if (ANNOUNCE_AT.has(left)) {
        announcer.speak(`${plural(left, 'second')} left to answer`, {
          priority: 60,
          dedupeKey: `invite-countdown:${invite.id}:${left}`,
        });
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [invite]);

  const details = invite
    ? sentence(
        `${invite.size} by ${invite.size} board`,
        `${plural(invite.players, 'player')} of ${invite.maxPlayers}`,
      )
    : '';

  return (
    <dialog
      ref={ref}
      aria-labelledby="invite-dialog-title"
      aria-describedby="invite-dialog-details"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 text-foreground backdrop:bg-black/60"
      onClick={event => {
        if (event.target === ref.current) onDecline();
      }}>
      {invite ? (
        <div className="flex flex-col gap-3">
          <h2 id="invite-dialog-title" className="text-lg font-bold text-foreground">
            Game invitation
          </h2>

          <p id="invite-dialog-details" className="text-sm text-muted-foreground">
            {sentence(`${userLabel(invite.from)} invited you to a game`, details)}
          </p>

          {/*
            The countdown updates every second, so it must not be a live region
            — a screen reader would read it continuously. The dialog announces
            the time at a few thresholds instead, and this stays visual only.
          */}
          <p aria-hidden="true" className="text-sm text-muted-foreground">
            {remaining > 0
              ? `${plural(remaining, 'second')} left to answer`
              : 'This invitation has expired'}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              disabled={busy}
              aria-label={`Decline the invitation from ${invite.from.name}`}
              onClick={onDecline}>
              Decline
            </Button>
            <Button
              ref={acceptRef}
              size="md"
              loading={busy}
              disabled={remaining === 0}
              aria-label={`Accept the invitation from ${invite.from.name} and join their game`}
              onClick={onAccept}>
              Accept
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
