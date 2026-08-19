import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface SettingToggleProps {
  label: string;
  /** Shown under the label, and used as the control's description. */
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Extra context, e.g. why a control is currently unavailable. */
  hint?: string;
}

/**
 * One labelled switch row, replacing the mobile `SettingToggle`.
 *
 * The whole row *is* the control — a `<button role="switch">` wrapping the
 * label, description and the track. That is deliberate: as separate elements a
 * screen reader stops on the label, the description and the switch in turn, and
 * only the last of those says whether it is on. It also makes the entire row a
 * click target, which is far easier to hit on a phone than a 44px track.
 */
export function SettingToggle({
  label,
  description,
  value,
  onChange,
  disabled = false,
  hint,
}: SettingToggleProps) {
  const id = useId();
  const describedBy = hint ? `${id}-desc ${id}-hint` : `${id}-desc`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        'flex w-full items-center justify-between gap-4 rounded-2xl border border-border',
        'bg-card p-4 text-left transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-ring/60',
      )}>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-base font-semibold text-foreground">{label}</span>
        <span id={`${id}-desc`} className="text-sm text-muted-foreground">
          {description}
        </span>
        {hint ? (
          <span id={`${id}-hint`} className="text-xs text-muted-foreground/80">
            {hint}
          </span>
        ) : null}
      </span>

      {/* Purely presentational: the button above already carries the state. */}
      <span
        aria-hidden="true"
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          value ? 'bg-primary' : 'bg-muted',
        )}>
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full transition-all',
            value ? 'left-[1.375rem] bg-primary-foreground' : 'left-0.5 bg-foreground/60',
          )}
        />
      </span>
    </button>
  );
}
