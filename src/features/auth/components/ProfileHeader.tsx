import { cn } from '@/lib/cn';
import { initials } from '@/features/game/utils';
import type { User } from '@/types';

export interface ProfileHeaderProps {
  user: User;
  /** Stacked (avatar above text) or inline (avatar beside text). */
  orientation?: 'vertical' | 'horizontal';
  size?: 'md' | 'lg';
}

/**
 * Avatar + name + email block for the authenticated user, shared by the Home
 * and Profile pages. Falls back to initials when there is no photo — a Google
 * account usually has one, an email/password account never does.
 */
export function ProfileHeader({
  user,
  orientation = 'vertical',
  size = 'lg',
}: ProfileHeaderProps) {
  const dimension = size === 'lg' ? 'h-20 w-20 text-xl' : 'h-14 w-14 text-base';

  const avatar = user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      // Decorative: the name is rendered as text right beside it, so announcing
      // it again would just repeat the row.
      alt=""
      className={cn('shrink-0 rounded-full object-cover', dimension)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
        dimension,
      )}>
      {initials(user.fullName || user.email)}
    </span>
  );

  return (
    <div
      className={cn(
        'flex gap-4',
        orientation === 'vertical'
          ? 'flex-col items-center text-center'
          : 'flex-row items-center',
      )}>
      {avatar}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-lg font-semibold text-foreground">
          {user.fullName || 'Player'}
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}
