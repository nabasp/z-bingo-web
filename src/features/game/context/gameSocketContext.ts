import { createContext } from 'react';
import type {
  GameError,
  PublicPlayer,
  RoomSnapshot,
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
  winner: WinnerDeclaredPayload | null;
  /** This device's player within the room, if any. */
  me: PublicPlayer | null;
  isHost: boolean;
  isMyTurn: boolean;
  clearError: () => void;

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
