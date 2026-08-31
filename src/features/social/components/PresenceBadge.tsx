import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { Presence } from '../types';
import { presenceLabel } from '../a11y/socialSpeechEvents';

/**
 * A friend's availability.
 *
 * Colour is never the only carrier: the word is always present, and the glyph
 * differs per state too, so the badge still reads correctly to someone who
 * cannot distinguish the dot colours. `aria-hidden` because the enclosing row
 * already speaks this as part of its own composed label.
 */
const GLYPHS: Record<Presence, string> = {
  online: '●',
  in_game: '▶',
  offline: '○',
};

const TONES: Record<Presence, string> = {
  online: 'text-emerald-400',
  in_game: 'text-amber-400',
  offline: 'text-muted-foreground',
};

export const PresenceBadge = memo(function PresenceBadge({
  presence,
  className,
}: {
  presence: Presence;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex items-center gap-1.5 text-sm', TONES[presence], className)}>
      <span aria-hidden="true">{GLYPHS[presence]}</span>
      <span>{presenceLabel(presence)}</span>
    </span>
  );
});
