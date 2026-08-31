import { createContext } from 'react';
import type { GameSocket } from '@/lib/socketClient';
import type {
  GameError,
  PublicPlayer,
  RoomClosedPayload,
  RoomSnapshot,
  ServerToClientEvents,
  WinnerDeclaredPayload,
} from '../types/events';

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'offline';

export interface GameSocketValue {
  connection: SocketStatus;
  /**
   * True once the server has answered the post-connect `sync`.
   *
   * `connection === 'connected'` is NOT the same question. The socket reports
   * connected the instant the transport opens, but whether this player is in a
   * room is only known when the `sync` ack lands a moment later. Anything that
   * branches on "am I in a room" — the game-route guard, above all — has to
   * wait for this, or a page refresh mid-match reads `room === null` and throws
   * the player out of a game the server still has them in.
   */
  synced: boolean;
  room: RoomSnapshot | null;
  /** Last server error, for inline display. Cleared by `clearError`. */
  error: GameError | null;
  /**
   * Why the last room ended, when it ended without the player choosing it.
   *
   * Separate from `error` because it outlives the screen it happened on: the
   * room disappears, the guard sends the player home, and the explanation has
   * to survive that navigation or they arrive with no idea what happened.
   */
  notice: RoomClosedPayload | null;
  winner: WinnerDeclaredPayload | null;
  /** This device's player within the room, if any. */
  me: PublicPlayer | null;
  isHost: boolean;
  isMyTurn: boolean;
  clearError: () => void;
  clearNotice: () => void;

  /**
   * Subscribe to a server event on the shared socket.
   *
   * This is the seam the social feature uses. It exists so friends, presence
   * and invitations ride the ONE authenticated connection this provider owns,
   * rather than opening a second one — and so each subscriber gets an
   * unsubscribe back, which is what keeps listeners from accumulating across
   * reconnects. Registrations survive the socket being replaced (sign-out,
   * reconnect): they are re-attached to whatever socket is current.
   */
  on<E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E],
  ): () => void;

  /**
   * Send an ack-style event and get the reply as a promise.
   *
   * Rejects with a `GameRequestError` carrying the server's code and details.
   * The callback receives the typed socket, so every event name and payload is
   * checked against the wire contract.
   */
  request<T>(
    run: (
      socket: GameSocket,
      resolve: (value: T) => void,
      reject: (error: Error) => void,
    ) => void,
  ): Promise<T>;

  createRoom: (
    size: number,
    maxPlayers: number,
    turnSeconds: number,
  ) => Promise<RoomSnapshot>;
  joinRoom: (code: string) => Promise<RoomSnapshot>;
  setReady: (ready: boolean) => void;
  setSize: (size: number) => void;
  setTurnSeconds: (turnSeconds: number) => void;
  startGame: () => void;
  submitBoard: (board: number[]) => void;
  callNumber: (value: number) => void;
  rematch: (size?: number) => void;
  leaveRoom: () => void;
}

/**
 * The context object lives apart from the provider component.
 *
 * React Fast Refresh re-evaluates a changed module, and a file exporting both a
 * component and a `createContext` call hands out a brand new context on every
 * edit while the mounted tree still holds the old one — every consumer then
 * reads `undefined` and the app dies with "must be used within a Provider".
 * A component-free module keeps the context stable across hot updates.
 */
export const GameSocketContext = createContext<GameSocketValue | undefined>(
  undefined,
);
