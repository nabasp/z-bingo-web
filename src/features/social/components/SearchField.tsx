import { useId, type InputHTMLAttributes, type Ref } from 'react';
import { cn } from '@/lib/cn';

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'value' | 'onChange'> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Guidance read out with the field, e.g. the minimum query length. */
  hint?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A plain controlled text field.
 *
 * The shared `TextField` is bound to React Hook Form — it needs a `control`
 * and a `name` — which is the right shape for the auth forms and the wrong one
 * for a search box that is just a piece of local state. Rather than bend that
 * component (or pull a form library into a search input), this mirrors its
 * accessibility wiring: a real `<label htmlFor>`, and `aria-describedby`
 * pointing at the hint so the guidance is read on focus rather than sitting in
 * a sibling node a screen reader never reaches.
 *
 * `role="searchbox"` is deliberately not set — a plain `type="search"` input
 * already has the right semantics, and overriding the role loses the browser's
 * built-in clear control.
 */
export function SearchField({
  label,
  value,
  onValueChange,
  hint,
  className,
  ref,
  ...inputProps
}: SearchFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>

      <div className="flex w-full items-center rounded-xl border border-input bg-card focus-within:border-ring">
        <input
          {...inputProps}
          id={id}
          ref={ref}
          type="search"
          value={value}
          onChange={event => onValueChange(event.target.value)}
          aria-describedby={hint ? hintId : undefined}
          // 16px minimum, or iOS Safari zooms the page on focus.
          className="min-h-11 w-full bg-transparent px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
