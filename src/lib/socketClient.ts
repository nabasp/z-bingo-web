import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/config/env';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/features/game/types/events';
import { apiClient } from './apiClient';

/** Resolve a fresh Firebase ID token for the handshake, tolerating failures. */
async function handshakeToken(): Promise<{ accessToken: string }> {
  try {
    return { accessToken: (await apiClient.getIdToken()) ?? '' };
  } catch {
    return { accessToken: '' };
  }
}

/** Note the swapped generics: what we listen for vs what we emit. */
export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Create (but do not connect) the game socket.
 *
 * `auth` is a FUNCTION, not an object: socket.io re-evaluates it on every
 * reconnect attempt, so a freshly-minted Firebase ID token is always sent.
 * Passing a plain object would pin the token captured at construction time, and
 * every reconnect after an expiry would fail auth — which matters here because
 * the server actively disconnects a socket when its token reaches `exp`
 * (`bingo-node/src/modules/socket/socket.middleware.ts`).
 *
 * Unlike the mobile client this does NOT force `transports: ['websocket']`.
 * Browsers sit behind proxies and corporate networks that block raw WebSocket
 * upgrades, so the default polling-then-upgrade path is the resilient choice.
 */
export function createGameSocket(): GameSocket {
  return io(API_BASE_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    withCredentials: false,
    auth: cb => {
      void handshakeToken().then(cb);
    },
  });
}
