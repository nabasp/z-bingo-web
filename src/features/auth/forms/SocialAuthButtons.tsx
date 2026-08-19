import { Banner, Button } from '@/components/ui';
import { useSocialAuth } from '../hooks';

/**
 * "Continue with Google" plus an "or" divider, shared by the Sign In and Sign
 * Up pages. On success the global auth state flips and the router swaps to the
 * app automatically.
 *
 * Apple is deliberately absent: it is iOS-only in the mobile app, and on the
 * web it needs an Apple Developer Service ID and a verified return URL
 * configured in Firebase before it would work at all.
 */
export function SocialAuthButtons() {
  const { googleLoading, errorMessage, onGoogle } = useSocialAuth();

  return (
    <div className="flex w-full flex-col gap-4">
      {errorMessage ? <Banner variant="error">{errorMessage}</Banner> : null}

      <Button variant="outline" fullWidth loading={googleLoading} onClick={onGoogle}>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs tracking-wide text-muted-foreground uppercase">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
