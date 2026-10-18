import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  PageHeading,
  PageShell,
  SectionLabel,
  Spinner,
} from '@/components/ui';
import { plural, sentence } from '@/lib/a11y/phrases';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { useGameSocket } from '@/features/game/context';
import { OptionSelector } from '@/features/game/components';
import {
  PartyPlayerRow,
  PresenceBadge,
  SearchField,
  sortFriends,
  useSocial,
} from '@/features/social';
import type { Friend } from '@/features/social';
import { presenceLabel, userLabel } from '@/features/social/a11y/socialSpeechEvents';
import { PATHS } from '../paths';

const PLAYER_OPTIONS = [2, 3];

/**
 * Start a game from the people, not the settings.
 *
 * Choose how many players, then invite as many friends as you like. No room is
 * created when you invite — one appears once enough of them accept, which is
 * what lets you invite five friends for a three-player game and take whoever
 * answers first.
 */
export function PlayWithFriendsPage() {
  const navigate = useNavigate();
  const { room } = useGameSocket();
  const {
    loading,
    me,
    friends,
    party,
    error,
    clearError,
    partyNotice,
    clearPartyNotice,
    sendInvite,
    startParty,
    cancelParty,
  } = useSocial();

  const [players, setPlayers] = useState(2);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * Whether this player is assembling the game or waiting in someone else's.
   *
   * A guest who accepted a three-player invitation lands here to wait, and
   * almost none of the host's page applies to them: they cannot invite (the
   * server refuses — they are committed to a game they do not own), they
   * cannot change the player count, and they cannot start it.
   */
  const isHost = party !== null && me !== null && party.host.id === me.id;
  const isGuest = party !== null && !isHost;

  // Once anyone is invited the count is fixed: changing it would redefine what
  // they already said yes to. The server enforces it; this reflects it.
  const locked = party !== null;
  const target = party?.targetPlayers ?? players;

  const invitedIds = new Set(party?.invited.map(entry => entry.user.id) ?? []);
  const visible = sortFriends(friends).filter(friend =>
    query.trim()
      ? `${friend.handle} ${friend.name}`.toLowerCase().includes(query.trim().toLowerCase())
      : true,
  );

  /*
   * The room arriving is what ends this page.
   *
   * `useGameFlowNavigation` only runs under the game routes, so a room created
   * out from under this page would set state and move nobody. Handing over to
   * the lobby explicitly is what completes the journey.
   */
  useEffect(() => {
    if (room) navigate(PATHS.lobby, { replace: true });
  }, [room, navigate]);

  const headingRef = useAnnounceOnFocus({
    title: 'Play with friends',
    detail: party
      ? sentence(
          `${party.players.length} of ${party.targetPlayers} players`,
          party.canStart ? 'You can start now, or wait for more' : 'Waiting for someone to accept',
        )
      : sentence(
          `A ${plural(players, 'player')} game`,
          'Choose how many players, then invite friends',
        ),
    key: party ? `${party.players.length}/${party.targetPlayers}` : `setup:${players}`,
  });

  const invite = useCallback(
    async (friend: Friend) => {
      setBusy(friend.id);
      try {
        await sendInvite(friend.id, target);
      } catch {
        // The message is already in the error banner.
      } finally {
        setBusy(null);
      }
    },
    [sendInvite, target],
  );

  const inviteHint = (friend: Friend): string => {
    if (invitedIds.has(friend.id)) return 'Already invited';
    if (friend.presence === 'in_game') return 'They are already in a game';
    if (friend.presence === 'offline') return 'They are offline';
    return `Invites ${friend.name} to a ${plural(target, 'player')} game`;
  };

  return (
    <PageShell width="wide">
      <PageHeading
        headingRef={headingRef}
        title={isGuest ? `${party.host.name}'s game` : 'Play with friends'}
        subtitle={
          party
            ? `${party.players.length} of ${party.targetPlayers} players`
            : 'Invite friends to a new game'
        }
      />

      {isGuest ? (
        <Banner variant="info">
          {`You're in. Waiting for ${plural(
            party.targetPlayers - party.players.length,
            'more player',
          )} before the game starts.`}
        </Banner>
      ) : null}

      {partyNotice ? (
        <Banner variant="info" onDismiss={clearPartyNotice}>
          {partyNotice}
        </Banner>
      ) : null}

      {error ? (
        <Banner variant="error" onDismiss={clearError}>
          {error}
        </Banner>
      ) : null}

      {isGuest ? null : (
      <OptionSelector<number>
        label="Players"
        layout="row"
        value={target}
        onChange={setPlayers}
        disabled={locked}
        hint={
          locked
            ? 'The player count is fixed once you have invited someone. Cancel the game to change it.'
            : 'Including you.'
        }
        options={PLAYER_OPTIONS.map(n => ({ value: n, label: `${n} Players` }))}
      />
      )}

      {party ? (
        <section className="flex w-full flex-col gap-3">
          <SectionLabel>{`Game: ${party.players.length} of ${party.targetPlayers} players`}</SectionLabel>
          <div role="list" className="flex w-full flex-col gap-3">
            {party.players.map((player, index) => (
              <PartyPlayerRow
                key={player.id}
                user={player}
                seatIndex={index}
                status={player.id === party.host.id ? 'host' : 'accepted'}
              />
            ))}
            {party.invited
              .filter(entry => entry.status !== 'accepted')
              .map((entry, index) => (
                <PartyPlayerRow
                  key={entry.user.id}
                  user={entry.user}
                  seatIndex={party.players.length + index}
                  status={entry.status}
                />
              ))}
          </div>

          <div className="flex w-full flex-wrap gap-2">
            {isGuest ? (
              <Button variant="outline" onClick={() => void cancelParty()}>
                Leave game
              </Button>
            ) : (
            <>
            <Button
              disabled={!party.canStart}
              title={
                party.canStart
                  ? `Starts the game now with ${plural(party.players.length, 'player')}, without waiting for the rest`
                  : `You need at least 2 players — ${plural(party.players.length, 'player')} so far`
              }
              onClick={() => void startParty()}>
              Start now
            </Button>
            <Button variant="outline" onClick={() => void cancelParty()}>
              Cancel game
            </Button>
            </>
            )}
          </div>
        </section>
      ) : null}

      {isGuest ? null : (
      <section className="flex w-full flex-col gap-3">
        <SectionLabel>Invite friends</SectionLabel>

        {loading ? (
          <Spinner size="lg" label="Loading your friends" className="text-primary" />
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no friends yet. Add someone on the Friends page first.
          </p>
        ) : (
          <>
            <SearchField
              label="Search your friends"
              value={query}
              onValueChange={setQuery}
              placeholder="alex"
              autoComplete="off"
              hint="Available friends are listed first."
            />

            <div role="list" className="flex w-full flex-col gap-3">
              {visible.map(friend => {
                const invited = invitedIds.has(friend.id);
                const canInvite =
                  friend.presence === 'online' && !invited && busy !== friend.id;

                return (
                  <Card
                    key={friend.id}
                    role="listitem"
                    aria-label={sentence(
                      userLabel(friend),
                      presenceLabel(friend.presence),
                      invited ? 'Invited' : undefined,
                    )}
                    className="flex w-full items-center justify-between gap-3">
                    <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-base font-semibold text-foreground">
                        {friend.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm text-muted-foreground">
                          @{friend.handle}
                        </span>
                        <PresenceBadge presence={friend.presence} />
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      disabled={!canInvite}
                      loading={busy === friend.id}
                      aria-label={`Invite ${friend.name}`}
                      title={inviteHint(friend)}
                      onClick={() => void invite(friend)}>
                      {invited ? 'Invited' : 'Invite'}
                    </Button>
                  </Card>
                );
              })}
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No friends match that search.
                </p>
              ) : null}
            </div>
          </>
        )}
      </section>
      )}

      {isGuest ? null : (
        <Button variant="outline" onClick={() => navigate(PATHS.home)}>
          Back to home
        </Button>
      )}
    </PageShell>
  );
}
