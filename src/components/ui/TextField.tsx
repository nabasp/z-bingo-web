import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@/lib/cn';

export interface TextFieldProps<TValues extends FieldValues>
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'name' | 'value' | 'onChange' | 'onBlur' | 'className'
  > {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  /** Optional trailing slot (e.g. a show/hide password toggle). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Controlled, validated text field — the web counterpart of the mobile
 * `FormInput`, bridging React Hook Form to a native `<input>`.
 *
 * The accessibility wiring is what makes this a component rather than a styled
 * input: a real `<label htmlFor>` (so clicking the label focuses the field and
 * a screen reader reads it on focus), `aria-invalid` and `aria-describedby`
 * pointing at the error text. The mobile version has to fold its error into
 * `accessibilityHint` because the message sits in a sibling node a screen
 * reader would never reach; on the web `aria-describedby` does that properly.
 */
export function TextField<TValues extends FieldValues>({
  control,
  name,
  label,
  trailing,
  className,
  ...inputProps
}: TextFieldProps<TValues>) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = Boolean(fieldState.error);
        return (
          <div className={cn('w-full', className)}>
            <label
              htmlFor={id}
              className="mb-1.5 block text-sm font-medium text-foreground">
              {label}
            </label>

            <div
              className={cn(
                'flex w-full items-center rounded-xl border bg-card',
                'focus-within:border-ring',
                hasError ? 'border-destructive' : 'border-input',
              )}>
              <input
                {...inputProps}
                id={id}
                name={field.name}
                ref={field.ref}
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={hasError || undefined}
                aria-describedby={hasError ? errorId : undefined}
                // 16px minimum, or iOS Safari zooms the page on focus.
                className="min-h-11 w-full bg-transparent px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              {trailing ? <div className="pr-2.5">{trailing}</div> : null}
            </div>

            {hasError ? (
              <p id={errorId} className="mt-1 text-xs text-destructive">
                {fieldState.error?.message}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}
