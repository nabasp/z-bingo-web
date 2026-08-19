import type { Ref } from 'react';
import { useNavigate } from 'react-router-dom';

export interface GameScreenHeaderProps {
  title: string;
  /** Renders a back control. Defaults to browser history when no handler given. */
  onBack?: () => void;
  showBack?: boolean;
  /** Focus target on arrival; see `useAnnounceOnFocus`. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/** Back control + page title, used on Create / Join / Lobby / Settings. */
export function GameScreenHeader({
  title,
  onBack,
  showBack = true,
  headingRef,
}: GameScreenHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-4">
      {showBack ? (
        <button
          type="button"
          onClick={onBack ?? (() => navigate(-1))}
          aria-label="Go back"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-lg text-foreground hover:border-ring">
          {/* The chevron is decoration; the label above carries the meaning. */}
          <span aria-hidden="true" className="leading-none">
            ‹
          </span>
        </button>
      ) : null}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold text-foreground outline-none">
        {title}
      </h1>
    </div>
  );
}
