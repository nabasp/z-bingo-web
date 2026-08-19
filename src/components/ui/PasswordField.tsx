import { useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { TextField, type TextFieldProps } from './TextField';

export type PasswordFieldProps<TValues extends FieldValues> = Omit<
  TextFieldProps<TValues>,
  'type' | 'trailing' | 'autoCapitalize'
>;

/**
 * Password field with a Show/Hide toggle.
 *
 * Reuses `TextField` for label, validation and ARIA wiring and adds a
 * text-based visibility toggle (no icon dependency in this project), matching
 * the mobile `PasswordInput`.
 */
export function PasswordField<TValues extends FieldValues>(
  props: PasswordFieldProps<TValues>,
) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          // The button's own state, not just its action: a screen reader user
          // needs to know whether the password is currently exposed.
          aria-pressed={visible}
          className="rounded px-2 py-2 text-xs font-semibold text-primary hover:underline"
          title={visible ? 'Hide password' : 'Show password'}>
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
