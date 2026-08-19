import { useEffect, useRef } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation step for actions that cannot be undone.
 *
 * Leaving a match mid-game hands the opponent a walkover win on the server, so
 * a single mis-click currently forfeits the game with no warning. This is the
 * guard for that class of action, replacing the mobile `ConfirmDialog`.
 *
 * Built on the native `<dialog showModal()>`, which is what gives us — for free
 * and correctly — the focus trap, the inert background (a screen reader cannot
 * wander out into the content the dialog is asking about, the web equivalent of
 * `accessibilityViewIsModal`), Escape-to-dismiss and focus restoration on close.
 * Reimplementing any of that by hand would be strictly worse.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // Escape and the backdrop both fire `cancel`/`close`; route them to the
    // same place so dismissing never counts as confirming.
    const onClose = () => onCancel();
    dialog.addEventListener('cancel', onClose);
    return () => dialog.removeEventListener('cancel', onClose);
  }, [onCancel]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 text-foreground backdrop:bg-black/60"
      onClick={event => {
        // Clicking the backdrop (the dialog element itself, outside its box)
        // dismisses, matching the mobile scrim.
        if (event.target === ref.current) onCancel();
      }}>
      <div className="flex flex-col gap-3">
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-foreground">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="text-sm text-muted-foreground">
          {message}
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="md"
            onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
