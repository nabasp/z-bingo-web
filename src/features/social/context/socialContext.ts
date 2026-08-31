import { createContext } from 'react';
import type {
  Friend,
  FriendRequest,
  GameInvitePayload,
  PublicUser,
} from '../types';

/** How the last invitation this player sent is doing. */
export interface OutgoingInvite {
  id: string;
  toUserId: string;
  expiresAt: number;
}

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
  /** The invitation this player last sent, while it is still live. */
  outgoingInvite: OutgoingInvite | null;
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
  sendInvite: (userId: string) => Promise<void>;
  /** Accepting resolves with the room code so the caller can navigate. */
  respondToInvite: (id: string, accept: boolean) => Promise<string | null>;
  dismissInvite: () => void;
}

/**
 * Kept apart from the provider component for the same reason as the game
 * context: a module exporting both a component and a `createContext` hands out
 * a fresh context on every Fast Refresh, and every consumer reads `undefined`.
 */
export const SocialContext = createContext<SocialValue | undefined>(undefined);
