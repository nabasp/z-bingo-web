/*
 * One waiver, for the subscription effect: setting state as server events
 * arrive is this file's entire job, and the rule assumes an effect that writes
 * state is deriving it from props. Nothing else here needs an exemption —
 * unlike `GameSocketProvider`, this provider owns no socket ref of its own.
 */
/* eslint-disable react-hooks/set-state-in-effect */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GameRequestError, useGameSocket } from '@/features/game/context';
import type { Ack } from '@/features/game/types/events';
import { SocialContext, type OutgoingInvite, type SocialValue } from './socialContext';
import type {
  Friend,
  FriendRequest,
  FriendsSnapshot,
  GameInvitePayload,
  PublicUser,
} from '../types';

/** Turn an ack into a promise settlement, preserving the server's error code. */
function settle<T>(
  resolve: (value: T) => void,
  reject: (error: Error) => void,
): (res: Ack<T>) => void {
  return res => {
    if (res.ok) resolve(res.data);
    else reject(new GameRequestError(res.error));
  };
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Friends, presence and game invitations.
 *
 * Holds no connection of its own — it borrows the game provider's socket
 * through `on` and `request`, so the whole app has exactly one authenticated
 * connection. Every subscription is torn down on unmount via the unsubscribe
 * each `on` returns, which is what stops listeners stacking up across
 * reconnects.
 *
 * The server is authoritative throughout: every mutation acks with a fresh
 * snapshot rather than the client patching its own list, so two devices can
 * never disagree about who is a friend.
 */
export function SocialProvider({ children }: { children: ReactNode }) {
  const { connection, on, request } = useGameSocket();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [incomingInvite, setIncomingInvite] = useState<GameInvitePayload | null>(null);
  const [outgoingInvite, setOutgoingInvite] = useState<OutgoingInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The invitation this player last sent.
   *
   * A ref as well as state: the `invite_ended` listener is registered once, so
   * reading the state variable there would see whatever was outstanding when
   * the subscription was created, not now.
   */
  const outgoingRef = useRef<string | null>(null);
  useEffect(() => {
    outgoingRef.current = outgoingInvite?.id ?? null;
  }, [outgoingInvite]);

  const applySnapshot = useCallback((snapshot: FriendsSnapshot) => {
    setMe(snapshot.me);
    setFriends(snapshot.friends);
    setRequests(snapshot.requests);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await request<FriendsSnapshot>((socket, resolve, reject) => {
        socket.emit('friends_list', settle(resolve, reject));
      });
      applySnapshot(snapshot);
    } catch {
      // A failed refresh is not worth a banner — the socket may simply be
      // reconnecting, and the next `connected` transition retries.
      setLoading(false);
    }
  }, [request, applySnapshot]);

  // Load on connect, and reload on every reconnect: presence is derived from
  // live sockets, so a snapshot taken before a drop is stale about everyone.
  useEffect(() => {
    if (connection !== 'connected') return;
    void refresh();
  }, [connection, refresh]);

  useEffect(() => {
    const offRequest = on('friend_request_received', request_ => {
      setRequests(previous =>
        previous.some(r => r.id === request_.id) ? previous : [request_, ...previous],
      );
    });

    const offResolved = on('friend_request_resolved', ({ id, accepted, user }) => {
      setRequests(previous => previous.filter(r => r.id !== id));
      if (!accepted) return;
      setFriends(previous =>
        previous.some(f => f.id === user.id)
          ? previous
          : // Presence arrives in its own event a moment later; "online" is
            // the safe assumption for someone who just acted.
            [...previous, { ...user, presence: 'online' as const }].sort((a, b) =>
              a.handle.localeCompare(b.handle),
            ),
      );
    });

    // One event covers both "they removed you" and "they withdrew a request",
    // because from this side the effect is identical: that person is gone.
    const offRemoved = on('friend_removed', ({ userId }) => {
      setFriends(previous => previous.filter(f => f.id !== userId));
      setRequests(previous => previous.filter(r => r.user.id !== userId));
    });

    const offPresence = on('friend_presence', ({ userId, presence }) => {
      setFriends(previous =>
        previous.map(f => (f.id === userId ? { ...f, presence } : f)),
      );
    });

    const offInvite = on('invite_received', invite => setIncomingInvite(invite));

    const offEnded = on('invite_ended', ({ id, reason, message: text }) => {
      /*
       * Both parties receive this, and they need different things from it.
       *
       * The invitee chose the outcome, so telling them "the invitation was
       * declined" is just repeating their own tap back at them. The sender
       * chose nothing and is waiting — for them a decline or an expiry is the
       * only signal they will ever get, and without it they are left listening
       * to silence wondering whether it worked. Acceptance is the exception:
       * the room fills and the game state says so far better than a banner.
       */
      const wasSender = outgoingRef.current === id;
      setIncomingInvite(previous => (previous?.id === id ? null : previous));
      setOutgoingInvite(previous => (previous?.id === id ? null : previous));
      if (wasSender && reason !== 'accepted') setError(text);
    });

    return () => {
      offRequest();
      offResolved();
      offRemoved();
      offPresence();
      offInvite();
      offEnded();
    };
  }, [on]);

  /**
   * Run a mutation whose ack is a fresh snapshot.
   *
   * Every friendship change answers with the whole list rather than a delta,
   * so the client never patches its own copy and two devices cannot drift.
   */
  const mutate = useCallback(
    async (
      fallback: string,
      emit: Parameters<typeof request<FriendsSnapshot>>[0],
    ) => {
      setError(null);
      try {
        applySnapshot(await request<FriendsSnapshot>(emit));
      } catch (caught) {
        setError(message(caught, fallback));
        throw caught;
      }
    },
    [request, applySnapshot],
  );

  const search = useCallback(
    async (query: string): Promise<PublicUser[]> => {
      setError(null);
      try {
        const { results } = await request<{ results: PublicUser[] }>(
          (socket, resolve, reject) => {
            socket.emit('friend_search', { query }, settle(resolve, reject));
          },
        );
        return results;
      } catch (caught) {
        setError(message(caught, 'Could not search right now.'));
        return [];
      }
    },
    [request],
  );

  const sendRequest = useCallback(
    (userId: string) =>
      mutate('Could not send that request.', (socket, resolve, reject) => {
        socket.emit('friend_request', { userId }, settle(resolve, reject));
      }),
    [mutate],
  );

  const respondToRequest = useCallback(
    (id: string, accept: boolean) =>
      mutate('Could not answer that request.', (socket, resolve, reject) => {
        socket.emit('friend_respond', { id, accept }, settle(resolve, reject));
      }),
    [mutate],
  );

  const cancelRequest = useCallback(
    (id: string) =>
      mutate('Could not cancel that request.', (socket, resolve, reject) => {
        socket.emit('friend_cancel', { id }, settle(resolve, reject));
      }),
    [mutate],
  );

  const removeFriend = useCallback(
    (userId: string) =>
      mutate('Could not remove that friend.', (socket, resolve, reject) => {
        socket.emit('friend_remove', { userId }, settle(resolve, reject));
      }),
    [mutate],
  );

  const setHandle = useCallback(
    async (handle: string) => {
      setError(null);
      try {
        const updated = await request<PublicUser>((socket, resolve, reject) => {
          socket.emit('set_handle', { handle }, settle(resolve, reject));
        });
        setMe(updated);
      } catch (caught) {
        setError(message(caught, 'Could not change your handle.'));
        throw caught;
      }
    },
    [request],
  );

  const sendInvite = useCallback(
    async (userId: string) => {
      setError(null);
      try {
        const sent = await request<{ id: string; expiresAt: number }>(
          (socket, resolve, reject) => {
            socket.emit('invite_send', { userId }, settle(resolve, reject));
          },
        );
        setOutgoingInvite({ id: sent.id, toUserId: userId, expiresAt: sent.expiresAt });
      } catch (caught) {
        setError(message(caught, 'Could not send that invitation.'));
        throw caught;
      }
    },
    [request],
  );

  const respondToInvite = useCallback(
    async (id: string, accept: boolean): Promise<string | null> => {
      setError(null);
      try {
        const room = await request<{ code: string } | null>((socket, resolve, reject) => {
          socket.emit('invite_respond', { id, accept }, settle(resolve, reject));
        });
        setIncomingInvite(previous => (previous?.id === id ? null : previous));
        return room?.code ?? null;
      } catch (caught) {
        setError(message(caught, 'Could not answer that invitation.'));
        // The dialog closes either way: the reason is now in the error banner,
        // and leaving a dead invitation on screen helps nobody.
        setIncomingInvite(previous => (previous?.id === id ? null : previous));
        return null;
      }
    },
    [request],
  );

  const dismissInvite = useCallback(() => setIncomingInvite(null), []);

  const value = useMemo<SocialValue>(
    () => ({
      loading,
      me,
      friends,
      requests,
      incomingInvite,
      outgoingInvite,
      error,
      clearError: () => setError(null),
      refresh,
      search,
      sendRequest,
      respondToRequest,
      cancelRequest,
      removeFriend,
      setHandle,
      sendInvite,
      respondToInvite,
      dismissInvite,
    }),
    [
      loading,
      me,
      friends,
      requests,
      incomingInvite,
      outgoingInvite,
      error,
      refresh,
      search,
      sendRequest,
      respondToRequest,
      cancelRequest,
      removeFriend,
      setHandle,
      sendInvite,
      respondToInvite,
      dismissInvite,
    ],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}
