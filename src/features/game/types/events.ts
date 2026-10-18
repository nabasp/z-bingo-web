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
  | 'server_shutdown'
  /** Somebody turned down a rematch, or let the offer lapse. */
  | 'rematch_declined';

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


// ─────────────────────────────────────────────────────────────────────────────
// Social — friends, presence and game invitations.
//
// These ride the SAME socket as the game events above; the server registers
// their handlers on the one shared connection. Kept in this file because it is
// the mirror of the server's single `socket.types.ts`.
// ─────────────────────────────────────────────────────────────────────────────

/** Whether a friend can be invited right now. */
export type Presence = 'online' | 'in_game' | 'offline';

/** Why an invitation stopped being live. */
export type InviteEndReason = 'expired' | 'declined' | 'accepted' | 'cancelled';

/** Why a game being assembled stopped existing. */
export type PartyEndReason = 'started' | 'cancelled' | 'host_left' | 'expired';

/**
 * A player as another player sees them. Never carries an email — a handle is
 * how you refer to someone here, and the only identifier worth speaking.
 */
export interface PublicUser {
  id: string;
  /** Unique, e.g. "alex". Displayed and spoken with a leading "@". */
  handle: string;
  name: string;
  avatarUrl?: string;
}

export interface Friend extends PublicUser {
  presence: Presence;
}

/** A pending friendship, from the perspective of whoever is being told. */
export interface FriendRequest {
  /** The friendship's id — also what respond and cancel take. */
  id: string;
  user: PublicUser;
  direction: 'incoming' | 'outgoing';
  createdAt: number;
}

/** Everything the Friends screen needs, in one round trip. */
export interface FriendsSnapshot {
  me: PublicUser;
  friends: Friend[];
  requests: FriendRequest[];
}

/**
 * A live invitation, as shown to the invitee.
 *
 * There is no room yet — one is created once enough friends accept — so this
 * describes the game being assembled: who is asking, and how many players for.
 */
export interface GameInvitePayload {
  id: string;
  from: PublicUser;
  /** Total players the host wants, including themselves. */
  targetPlayers: number;
  /** Epoch ms. Counted down against, rather than a local duration. */
  expiresAt: number;
}

/** How an invited friend is doing, from the host's point of view. */
export type InviteeStatus = 'invited' | 'accepted' | 'declined' | 'expired';

export interface PartyInvitee {
  user: PublicUser;
  status: InviteeStatus;
}

/** The game being assembled, as both the host and the acceptors see it. */
export interface PartySnapshot {
  id: string;
  host: PublicUser;
  targetPlayers: number;
  /** The host plus everyone who has accepted, in order. */
  players: PublicUser[];
  invited: PartyInvitee[];
  /** True once there are enough players for the host to start early. */
  canStart: boolean;
}

export interface PartyEndedPayload {
  id: string;
  reason: PartyEndReason;
  message: string;
}

/** What answering an invitation did. */
export interface InviteAnswer {
  status: 'waiting' | 'joined' | 'declined';
  party?: PartySnapshot;
  room?: RoomSnapshot;
}

/** An invitation stopped being live, and why. Sent to both parties. */
export interface InviteEndedPayload {
  id: string;
  reason: InviteEndReason;
  message: string;
}

/**
 * What a client needs to join its room's audio.
 *
 * `url` travels with the token rather than being compiled into each client, so
 * the LiveKit address lives in one place on the server: changing it needs no
 * web image rebuild and no mobile release.
 *
 * `room` is opaque and deliberately *not* the room code — codes are recycled,
 * so the audio room carries a nonce.
 */
export interface VoiceCredentials {
  url: string;
  token: string;
  room: string;
  /** Epoch ms. Past this the client re-requests rather than reconnecting. */
  expiresAt: number;
}

/**
 * Where an open rematch offer stands.
 *
 * `waitingFor` carries names rather than ids so a client can say who it is
 * waiting on without holding the roster.
 */
export interface RematchState {
  /** True once everybody accepted and the next round has begun. */
  started: boolean;
  /** Display names of players who have not answered yet. */
  waitingFor: string[];
  /** Epoch ms after which silence ends the room. */
  expiresAt: number;
}

/** Sent to each player who has not yet answered an open rematch offer. */
export interface RematchOfferPayload {
  /** Who asked, by display name. */
  fromName: string;
  expiresAt: number;
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
  /**
   * Ask to play again, or accept an offer already open.
   *
   * Any player may ask, and the asker counts as having accepted. Acked so the
   * caller learns whether the round started, or whether it is now waiting on
   * somebody else.
   */
  rematch: (ack: (res: Ack<RematchState>) => void) => void;
  /** Turn down an open rematch. Closes the room for everybody. */
  rematch_decline: () => void;
  leave_room: () => void;

  // ── Voice ────────────────────────────────────────────────────────────────
  /**
   * Credentials for this room's audio.
   *
   * Acked, and on the socket for the same reason the social calls are: it is
   * already authenticated and already knows which room you are in, so there is
   * no membership argument for a caller to forge.
   */
  voice_token: (ack: (res: Ack<VoiceCredentials>) => void) => void;

  // ── Social ────────────────────────────────────────────────────────────────
  friends_list: (ack: (res: Ack<FriendsSnapshot>) => void) => void;
  friend_search: (
    payload: { query: string },
    ack: (res: Ack<{ results: PublicUser[] }>) => void,
  ) => void;
  friend_request: (
    payload: { userId: string },
    ack: (res: Ack<FriendsSnapshot>) => void,
  ) => void;
  friend_respond: (
    payload: { id: string; accept: boolean },
    ack: (res: Ack<FriendsSnapshot>) => void,
  ) => void;
  friend_cancel: (
    payload: { id: string },
    ack: (res: Ack<FriendsSnapshot>) => void,
  ) => void;
  friend_remove: (
    payload: { userId: string },
    ack: (res: Ack<FriendsSnapshot>) => void,
  ) => void;
  set_handle: (
    payload: { handle: string },
    ack: (res: Ack<PublicUser>) => void,
  ) => void;
  /**
   * Invite a friend into the game you are assembling.
   *
   * `players` opens the game on the first call and is fixed from then on.
   */
  invite_send: (
    payload: { userId: string; players: number },
    ack: (res: Ack<PartySnapshot>) => void,
  ) => void;
  invite_respond: (
    payload: { id: string; accept: boolean },
    ack: (res: Ack<InviteAnswer>) => void,
  ) => void;
  /** Start now with whoever has accepted, rather than waiting for the rest. */
  party_start: (ack: (res: Ack<RoomSnapshot>) => void) => void;
  /** Abandon the game being assembled. */
  party_cancel: (ack: (res: Ack<null>) => void) => void;
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
  /** A player wants another round; you have not answered yet. */
  rematch_offered: (payload: RematchOfferPayload) => void;
  /** The offer is no longer open — accepted by all, or the room is closing. */
  rematch_resolved: (payload: { started: boolean }) => void;
  room_closed: (payload: RoomClosedPayload) => void;
  error: (error: GameError) => void;
  session_superseded: () => void;

  // ── Social ────────────────────────────────────────────────────────────────
  friend_request_received: (request: FriendRequest) => void;
  friend_request_resolved: (payload: {
    id: string;
    accepted: boolean;
    user: PublicUser;
  }) => void;
  friend_removed: (payload: { userId: string }) => void;
  /** One friend's availability changed. Only their friends receive this. */
  friend_presence: (payload: { userId: string; presence: Presence }) => void;
  invite_received: (invite: GameInvitePayload) => void;
  /** Reaches both parties, so neither is left holding a dead invitation. */
  invite_ended: (payload: InviteEndedPayload) => void;
  /** The game being assembled changed — someone accepted, declined or left. */
  party_updated: (party: PartySnapshot) => void;
  /** It is over. `started` means it became a room. */
  party_ended: (payload: PartyEndedPayload) => void;
}
