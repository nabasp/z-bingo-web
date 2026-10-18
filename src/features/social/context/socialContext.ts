import { createContext } from 'react';
import type {
  Friend,
  FriendRequest,
  GameInvitePayload,
  PartySnapshot,
  PublicUser,
} from '../types';

export interface SocialValue {
  /** True until the first `friends_list` answers. */
  loading: boolean;
  /** This player's own profile — the handle to read out to a friend. */
  me: PublicUser | null;
  friends: Friend[];
  /** Both directions; `direction` says which. */
  requests: FriendRequest[];
  /** The invitation currently being offered to this player, if any. */
  incomingInvite: GameInvitePayload | null;
  /**
   * The game being assembled that this player is part of — hosting or waiting
   * in — before it becomes a room. Null when there is none.
   */
  party: PartySnapshot | null;
  /** Why the last game being assembled ended, when it was not this player. */
  partyNotice: string | null;
  /** Last failure, for inline display. */
  error: string | null;
  clearError: () => void;

  refresh: () => Promise<void>;
  search: (query: string) => Promise<PublicUser[]>;
  sendRequest: (userId: string) => Promise<void>;
  respondToRequest: (id: string, accept: boolean) => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  setHandle: (handle: string) => Promise<void>;
  /**
   * Invite a friend into a game of `players`.
   *
   * The first call opens the game; later ones add to it. The count is fixed
   * once anyone has been invited.
   */
  sendInvite: (userId: string, players: number) => Promise<void>;
  /**
   * Answer an invitation.
   *
   * Resolves with `joined` only when that acceptance filled the game — for a
   * three-player game the first acceptor gets `waiting` and stays put until
   * someone else completes it.
   */
  respondToInvite: (
    id: string,
    accept: boolean,
  ) => Promise<'waiting' | 'joined' | 'declined' | 'failed'>;
  dismissInvite: () => void;
  /** Start now with whoever has accepted. */
  startParty: () => Promise<boolean>;
  /** Abandon the game being assembled. */
  cancelParty: () => Promise<void>;
  clearPartyNotice: () => void;
}

/**
 * Kept apart from the provider component for the same reason as the game
 * context: a module exporting both a component and a `createContext` hands out
 * a fresh context on every Fast Refresh, and every consumer reads `undefined`.
 */
export const SocialContext = createContext<SocialValue | undefined>(undefined);
