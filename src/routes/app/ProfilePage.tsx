import { useNavigate } from 'react-router-dom';
import { Button, PageHeading, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { ProfileHeader } from '@/features/auth/components';
import { useAuth } from '@/features/auth/context';
import { HandleEditor } from '@/features/social';
import type { User } from '@/types';
import { PATHS } from '../paths';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Only reachable when authenticated, so `user` is always present; the
  // fallback just satisfies the type.
  const currentUser: User = user ?? {
    id: '',
    fullName: 'Player',
    email: '',
    avatarUrl: undefined,
    emailVerified: false,
    hasPasswordProvider: false,
  };

  const headingRef = useAnnounceOnFocus({
    title: 'Profile',
    detail: 'Change your handle, open settings, or log out.',
  });

  // TODO(api): build the edit-profile flow. Until it exists the control is
  // shown disabled rather than silently doing nothing when pressed.
  const editProfileAvailable = false;

  return (
    <PageShell>
      <PageHeading headingRef={headingRef} title="Profile" subtitle="Manage your account" />

      <ProfileHeader user={currentUser} orientation="vertical" size="lg" />

      <hr className="w-full border-border" />

      <HandleEditor />

      <hr className="w-full border-border" />

      <div className="flex w-full flex-col gap-4">
        <Button fullWidth disabled={!editProfileAvailable}>
          Edit Profile
        </Button>
        <Button variant="secondary" fullWidth onClick={() => navigate(PATHS.settings)}>
          Settings
        </Button>
        {/* Clears the session; the guards swap back to the sign-in page. */}
        <Button variant="outline" fullWidth onClick={() => void logout()}>
          Log out
        </Button>
      </div>
    </PageShell>
  );
}
