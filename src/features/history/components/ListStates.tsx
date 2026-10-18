import { Banner, Button, Spinner } from '@/components/ui';

/** A titled empty state, with an optional way forward. */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?(): void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {actionLabel && onAction ? (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** A loading indicator that says what is loading. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex w-full justify-center py-6">
      <Spinner label={label} />
    </div>
  );
}

/** A failure, in words, with a way to try again. */
export function ErrorState({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <div className="flex w-full flex-col gap-3">
      <Banner variant="error">{message}</Banner>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/**
 * "Load more", as a button rather than a scroll trigger.
 *
 * Content that appears by itself as you scroll is invisible to a keyboard and
 * moves the page under a screen reader. This is something you choose to press.
 */
export function LoadMoreButton({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress(): void;
}) {
  return (
    <Button variant="outline" fullWidth loading={loading} onClick={onPress}>
      {loading ? 'Loading…' : label}
    </Button>
  );
}
