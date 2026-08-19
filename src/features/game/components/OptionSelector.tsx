import { useId } from 'react';
import { cn } from '@/lib/cn';
import { SectionLabel } from '@/components/ui';

export interface SelectorOption<T> {
  value: T;
  label: string;
}

export interface OptionSelectorProps<T> {
  label: string;
  options: SelectorOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'grid' = wrapped chips (board size, timer); 'row' = equal-width row. */
  layout?: 'grid' | 'row';
  disabled?: boolean;
}

/**
 * Generic labelled chip selector — reused for Board Size, Max Players and Turn
 * Timer, mirroring the mobile `OptionSelector`.
 *
 * `role="radiogroup"` with `role="radio"` chips rather than a row of buttons:
 * it is a single choice among several, and the radio semantics are what tell a
 * screen reader "3 of 6 selected" instead of reading six unrelated buttons.
 */
export function OptionSelector<T extends string | number>({
  label,
  options,
  value,
  onChange,
  layout = 'grid',
  disabled = false,
}: OptionSelectorProps<T>) {
  const labelId = useId();

  return (
    <div className="flex w-full flex-col gap-2">
      <SectionLabel id={labelId}>{label}</SectionLabel>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={cn(
          'w-full gap-2',
          layout === 'grid'
            ? 'grid grid-cols-3 sm:grid-cols-4'
            : 'grid grid-cols-2',
        )}>
        {options.map(option => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'min-h-11 rounded-xl border px-3 py-2.5 text-base transition-colors',
                selected
                  ? 'border-primary bg-primary font-bold text-primary-foreground'
                  : 'border-border bg-card font-medium text-foreground hover:border-ring',
                disabled && 'cursor-not-allowed opacity-50',
              )}>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
