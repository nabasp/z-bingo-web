import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  PageHeading,
  PageShell,
  SectionLabel,
  Spinner,
} from '@/components/ui';
import { plural, sentence } from '@/lib/a11y/phrases';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import {
  FriendRow,
  RequestRow,
  SearchField,
  SearchResultRow,
  sortFriends,
  useFriendSearch,
  useSocial,
} from '@/features/social';
import { PATHS } from '../paths';

/**
 * Friends, requests and search, in that order.
 *
 * The order is the accessibility decision: incoming requests come first
 * because they are the only thing on this page waiting on the player, then
 * friends (what they came for), then search (what they do less often). A
 * listener navigating top to bottom meets the actionable content first.
 */
export function FriendsPage() {
  const navigate = useNavigate();
  const {
    loading,
    me,
    friends,
    requests,
    error,
    clearError,
    respondToRequest,
    cancelRequest,
    removeFriend,
  } = useSocial();
  const { query, setQuery, results, searching, searched, relationOf, add, minLength } =
    useFriendSearch();

  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const incoming = requests.filter(r => r.direction === 'incoming');
  const outgoing = requests.filter(r => r.direction === 'outgoing');


  const headingRef = useAnnounceOnFocus({
    title: 'Friends',
    detail: sentence(
      me ? `You are @${me.handle}` : undefined,
      `${plural(friends.length, 'friend')}`,
      incoming.length > 0
        ? `${plural(incoming.length, 'friend request')} waiting`
        : undefined,
    ),
    key: `${friends.length}:${incoming.length}`,
  });

  const confirmRemove = useCallback(async () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    await removeFriend(id).catch(() => undefined);
    // Focus would otherwise fall to <body> when the row disappears; search is
    // the nearest stable landmark on this page.
    searchRef.current?.focus();
  }, [removing, removeFriend]);

  return (
    <PageShell width="wide">
      <PageHeading
        headingRef={headingRef}
        title="Friends"
        subtitle={me ? `You are @${me.handle}` : 'Loading your profile'}
      />

      {error ? (
        <Banner variant="error" onDismiss={clearError}>
          {error}
        </Banner>
      ) : null}


      {loading ? (
        <Spinner size="lg" label="Loading your friends" className="text-primary" />
      ) : (
        <div className="flex w-full flex-col gap-8">
          {incoming.length > 0 ? (
            <section className="flex w-full flex-col gap-3">
              <SectionLabel>{`Friend requests (${incoming.length})`}</SectionLabel>
              <div role="list" className="flex w-full flex-col gap-3">
                {incoming.map((request, index) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    seatIndex={index}
                    onAccept={() => void respondToRequest(request.id, true).catch(() => undefined)}
                    onDecline={() => void respondToRequest(request.id, false).catch(() => undefined)}
                    onCancel={() => void cancelRequest(request.id).catch(() => undefined)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex w-full flex-col gap-3">
            <SectionLabel>{`Your friends (${friends.length})`}</SectionLabel>
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No friends yet. Search for someone by their handle below.
              </p>
            ) : (
              <div role="list" className="flex w-full flex-col gap-3">
                {sortFriends(friends).map((friend, index) => (
                  <FriendRow
                    key={friend.id}
                    friend={friend}
                    seatIndex={index}
                    onRemove={() => setRemoving({ id: friend.id, name: friend.name })}
                  />
                ))}
              </div>
            )}
          </section>

          {outgoing.length > 0 ? (
            <section className="flex w-full flex-col gap-3">
              <SectionLabel>{`Sent requests (${outgoing.length})`}</SectionLabel>
              <div role="list" className="flex w-full flex-col gap-3">
                {outgoing.map((request, index) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    seatIndex={index}
                    onAccept={() => undefined}
                    onDecline={() => undefined}
                    onCancel={() => void cancelRequest(request.id).catch(() => undefined)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex w-full flex-col gap-3">
            <SectionLabel>Find people</SectionLabel>
            <SearchField
              ref={searchRef}
              label="Search by handle"
              value={query}
              onValueChange={setQuery}
              placeholder="alex"
              autoComplete="off"
              hint={`Type at least ${minLength} letters of someone's handle.`}
            />

            {/*
              One live region for the whole result set, so the count is
              announced once when it settles rather than the list re-reading
              itself on every keystroke.
            */}
            <p role="status" aria-live="polite" className="sr-only">
              {searching
                ? 'Searching'
                : searched
                  ? `${plural(results.length, 'result')} found`
                  : ''}
            </p>

            {searched && results.length === 0 && !searching ? (
              <p className="text-sm text-muted-foreground">
                Nobody found with that handle.
              </p>
            ) : null}

            {results.length > 0 ? (
              <div role="list" className="flex w-full flex-col gap-3">
                {results.map((user, index) => (
                  <SearchResultRow
                    key={user.id}
                    user={user}
                    seatIndex={index}
                    relation={relationOf(user.id)}
                    onAdd={() => void add(user.id).catch(() => undefined)}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <Button variant="outline" onClick={() => navigate(PATHS.home)}>
            Back to home
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove friend?"
        message={
          removing
            ? `${removing.name} will be removed from your friends list. You can add them again later.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </PageShell>
  );
}
