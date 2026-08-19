/**
 * Remembers which room this tab is in, so a page reload can rejoin it.
 *
 * **Why this is needed.** The server tracks a player's room on the socket
 * itself (`socket.data.roomCode`, set by the `create_room` / `join_room`
 * handlers). A reload — or any reconnect — opens a *new* socket with empty
 * `socket.data`, so the `sync` event answers "you are in no room" even while
 * the server is still holding the player's seat, board and turn. On a phone
 * that rarely comes up; in a browser, refreshing mid-match is routine.
 *
 * `join_room` is the server's own rejoin path — `RoomManager.joinRoom` checks
 * for an existing player *before* anything else and restores them at any game
 * status, which is exactly what the backend's own smoke test uses to verify
 * reconnection. So the fix is to remember the code and re-join, with no backend
 * change and nothing for the React Native client to care about.
 *
 * `sessionStorage`, not `localStorage`: this is one tab's game. The server
 * allows a single live socket per account, so letting a second tab inherit the
 * room would have the two fight over the connection.
 */

const KEY = 'bingo.room.code';

export function rememberRoom(code: string): void {
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // Private mode or blocked storage: reload-resume is simply unavailable.
  }
}

export function recallRoom(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetRoom(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
