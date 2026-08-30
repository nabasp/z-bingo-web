/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/types/events.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

/**
 * Socket wire contract — MIRROR of the server's source of truth at
 * `bingo-node/src/modules/socket/socket.types.ts`. Change both together.
 *
 * The server is authoritative for all of this: the client only renders these
 * payloads and sends intents.
 */

export type GameStatus = 'lobby' | 'setup' | 'playing' | 'finished';

export interface CallRecord {
  number: number;
  playerId: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  seat: number;
  ready: boolean;
  connected: boolean;
  /** Completed lines, capped at the board size. */
  letters: number;
}

export type LineType = 'row' | 'col' | 'diag' | 'anti';

export interface LineDescriptor {
  type: LineType;
  index: number;
  cells: number[];
}

export interface PlayerResult {
  playerId: string;
  name: string;
  seat: number;
  letters: number;
  lines: LineDescriptor[];
}

export interface RoomSnapshot {
  code: string;
  size: number;
  maxPlayers: number;
  status: GameStatus;
  hostId: string;
  /** The word spelled by completing lines, e.g. "BINGO" for a 5×5. */
  word: string;
  players: PublicPlayer[];
  currentTurnSeat: number;
  calledNumbers: number[];
  callHistory: CallRecord[];
  winnerId?: string;
  /** Seconds each turn lasts in this room. */
  turnSeconds: number;
  /** Epoch ms the current turn expires; absent outside play. */
  turnEndsAt?: number;
  /** Only ever this player's own board. */
  yourBoard?: number[];
}

export interface GameError {
  code: string;
  message: string;
  /**
   * Machine-readable extras. `already_in_room` carries `roomCode`, which is
   * what lets the UI offer "rejoin that room" instead of a dead end.
   */
  details?: Record<string, string>;
}

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: GameError };

export type TurnChangeReason = 'call' | 'timeout' | 'player_left' | 'start';

export interface TurnChangedPayload {
  seat: number;
  playerId: string;
  turnEndsAt?: number;
  reason: TurnChangeReason;
}

export interface WinnerDeclaredPayload {
  winnerId: string;
  results: PlayerResult[];
}

/** Why a room stopped existing. */
export type RoomCloseReason =
  | 'empty'
  | 'no_players_joined'
  | 'idle_timeout'
  | 'server_shutdown';

/**
 * The room is gone, and why.
 *
 * Without this a closed room is indistinguishable from a dropped connection:
 * the client simply stops hearing from a room it believes it is in. `message`
 * is worded server-side so web and mobile say exactly the same thing.
 */
export interface RoomClosedPayload {
  code: string;
  reason: RoomCloseReason;
  message: string;
}

export interface ClientToServerEvents {
  create_room: (
    payload: { size: number; maxPlayers: number; turnSeconds: number },
    ack: (res: Ack<RoomSnapshot>) => void,
  ) => void;
  join_room: (
    payload: { code: string },
    ack: (res: Ack<RoomSnapshot>) => void,
  ) => void;
  sync: (ack: (res: Ack<RoomSnapshot | null>) => void) => void;
  player_ready: (payload: { ready: boolean }) => void;
  set_size: (payload: { size: number }) => void;
  set_turn_seconds: (payload: { turnSeconds: number }) => void;
  start_game: () => void;
  submit_board: (payload: { board: number[] }) => void;
  call_number: (payload: { number: number }) => void;
  rematch: (payload: { size?: number }) => void;
  leave_room: () => void;
}

export interface ServerToClientEvents {
  /**
   * Deprecated: the server now sends `game_state_updated` to every member
   * instead, which is a strict superset. Still listened for so an older server
   * keeps working.
   */
  room_updated: (snapshot: RoomSnapshot) => void;
  game_state_updated: (snapshot: RoomSnapshot) => void;
  player_joined: (player: PublicPlayer) => void;
  player_left: (payload: { playerId: string; name: string }) => void;
  game_started: (snapshot: RoomSnapshot) => void;
  turn_changed: (payload: TurnChangedPayload) => void;
  winner_declared: (payload: WinnerDeclaredPayload) => void;
  /** This room has been closed; stop showing it and go home. */
  room_closed: (payload: RoomClosedPayload) => void;
  error: (error: GameError) => void;
  session_superseded: () => void;
}
