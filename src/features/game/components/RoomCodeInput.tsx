import { useId } from 'react';

export interface RoomCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Submits the surrounding form on Enter. */
  onEnter?: () => void;
}

/**
 * Room-code entry for the memorable two-word code (e.g. "brave-otter").
 *
 * A single centred field; normalization to the code charset happens upstream in
 * `useJoinRoom`, so typing "BRAVE OTTER" still lands on the right room.
 */
export function RoomCodeInput({ value, onChange, onEnter }: RoomCodeInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="w-full">
      <label htmlFor={id} className="sr-only">
        Room code
      </label>
      <input
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && onEnter) onEnter();
        }}
        placeholder="brave-otter"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        // The format is not guessable from a placeholder you cannot see.
        aria-describedby={hintId}
        className="h-14 w-full rounded-xl border border-input bg-card text-center text-lg font-semibold tracking-wide text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
      />
      <p id={hintId} className="mt-2 text-center text-sm text-muted-foreground">
        Two lowercase words joined by a hyphen, for example brave-otter
      </p>
    </div>
  );
}
