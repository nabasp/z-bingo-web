import { memo } from 'react';
import { cn } from '@/lib/cn';
import { initials } from '../utils';
import { playerAvatarClass } from '../constants';

export interface PlayerAvatarProps {
  name: string;
  /** Seat index picks the accent colour. */
  seatIndex?: number;
  size?: 'sm' | 'md' | 'lg';
}

const DIMS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-11 w-11 text-base',
} as const;

/**
 * Circular initials avatar, coloured by seat index.
 *
 * `aria-hidden` on purpose: every caller renders the name as text right beside
 * this, so announcing it again just doubles every player row.
 */
export const PlayerAvatar = memo(function PlayerAvatar({
  name,
  seatIndex = 0,
  size = 'md',
}: PlayerAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-neutral-900',
        DIMS[size],
        playerAvatarClass(seatIndex),
      )}>
      {initials(name)}
    </span>
  );
});
