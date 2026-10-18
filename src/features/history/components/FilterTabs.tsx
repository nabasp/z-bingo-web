import { cn } from '@/lib/cn';
import type { HistoryFilter } from '../history.types';

const FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'wins', label: 'Wins' },
  { value: 'losses', label: 'Losses' },
];

/**
 * All, Wins, Losses — a group of toggle buttons.
 *
 * `aria-pressed` rather than a tablist: these filter one list in place, they
 * do not swap between panels, and a tablist would promise arrow-key
 * behaviour and panels that are not there. Every screen reader announces
 * "pressed" on the current one, and Tab reaches each like any button.
 */
export function FilterTabs({
  value,
  onChange,
}: {
  value: HistoryFilter;
  onChange(next: HistoryFilter): void;
}) {
  return (
    <div role="group" aria-label="Filter games" className="flex w-full gap-2">
      {FILTERS.map(filter => {
        const selected = filter.value === value;
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(filter.value)}
            className={cn(
              'min-h-11 flex-1 rounded-xl border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              selected
                ? 'border-primary bg-primary font-bold text-primary-foreground'
                : 'border-border bg-card font-medium text-foreground hover:bg-card/80',
            )}>
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
