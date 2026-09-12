/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/audio/gameAudioEvents.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import type { SoundKey } from '@/lib/audio/soundRegistry';
import type { RoomSnapshot, TurnChangeReason } from '../types/events';
import { completedLines, toCells } from '../utils';

export interface AudioEvent {
  key: SoundKey;
  /** Offset playback so two cues that share a trigger instant don't collide. */
  delayMs?: number;
}

/** How long `letter_earned` trails the `line_complete` strike it accompanies. */
const LETTER_FANFARE_DELAY_MS = 350;

/** `your_turn` waits out the game-start sting when both land together. */
const TURN_AFTER_START_DELAY_MS = 1000;

/** A turn cue trails the timeout buzz that caused it. */
const TURN_AFTER_TIMEOUT_DELAY_MS = 650;

function ownCompletedLineCount(snapshot: RoomSnapshot): number {
  if (!snapshot.yourBoard) return 0;
  const cells = toCells(snapshot.yourBoard, snapshot.calledNumbers);
  return completedLines(cells, snapshot.size).length;
}

function isAllReady(snapshot: RoomSnapshot): boolean {
  return snapshot.players.length >= 2 && snapshot.players.every(p => p.ready);
}

function seatOf(snapshot: RoomSnapshot, myId: string | undefined): number | null {
  return snapshot.players.find(p => p.id === myId)?.seat ?? null;
}

/**
 * Translate a change in the authoritative room snapshot into sounds.
 *
 * Pure on purpose: every rule below is decided from `prev` → `next` alone, with
 * no React and no native module in the way, so the whole audio design is
 * unit-testable (see `gameAudioEvents.test.ts`).
 *
 * Three cues are NOT derivable from a snapshot and are fired at their call
 * sites instead: `room_created` (`useCreateRoom`), `board_shuffled` and
 * `board_submitted` (`useBoardSetup`).
 */
export interface AudioContext {
  /**
   * The `reason` from the server's own `turn_changed`, when one arrived with
   * this snapshot.
   *
   * The inference below is a good guess and nothing more — the server has
   * always said outright why a turn moved, and nobody was listening. When this
   * is present it is believed; when it is not, the guess stands, so an older
   * server or a dropped event degrades rather than breaks.
   */
  turnChangeReason?: TurnChangeReason;
}

export function deriveAudioEvents(
  prev: RoomSnapshot | null,
  next: RoomSnapshot | null,
  myId: string | undefined,
  { turnChangeReason }: AudioContext = {},
): AudioEvent[] {
  if (!next) return [];

  // Entering a room for the first time. A mid-game reconnect also arrives as
  // null → snapshot, so this is limited to actually landing in a lobby, and the
  // host is skipped because `useCreateRoom` already played `room_created`.
  if (!prev) {
    return next.status === 'lobby' && next.hostId !== myId
      ? [{ key: 'lobby_joined' }]
      : [];
  }

  // A different room entirely (rematch into a new code, or room switch): treat
  // it as a fresh entry rather than diffing unrelated state.
  if (prev.code !== next.code) return [];

  // The game ending outranks everything. Emitting the stinger alone keeps the
  // most important moment clean instead of piling a call, a line and a letter
  // underneath it.
  if (prev.status !== 'finished' && next.status === 'finished') {
    const winnerId = next.winnerId;
    return [{ key: winnerId && winnerId === myId ? 'you_win' : 'you_lose' }];
  }

  const events: AudioEvent[] = [];

  // ── Roster changes ───────────────────────────────────────────────────────
  const previousIds = new Set(prev.players.map(p => p.id));
  const nextIds = new Set(next.players.map(p => p.id));

  const someoneJoined = next.players.some(
    p => p.id !== myId && !previousIds.has(p.id),
  );
  if (someoneJoined) events.push({ key: 'lobby_joined' });

  const someoneLeft = prev.players.some(p => p.id !== myId && !nextIds.has(p.id));
  if (someoneLeft) events.push({ key: 'player_left' });

  // The server holds a disconnected player's seat for 60 s; `connected` flipping
  // back is them making it in under the wire.
  const someoneReconnected = next.players.some(p => {
    if (p.id === myId || !p.connected) return false;
    const before = prev.players.find(q => q.id === p.id);
    return before !== undefined && !before.connected;
  });
  if (someoneReconnected) events.push({ key: 'player_reconnected' });

  // The room collapsing back to the lobby: the server does this when setup
  // drops below the minimum player count, wiping every submitted board.
  // (Note the host merely *leaving* does not close a room — the server
  // reassigns the host to the lowest remaining seat.)
  if (prev.status === 'setup' && next.status === 'lobby') {
    events.push({ key: 'room_closed' });
  }

  const meBefore = prev.players.find(p => p.id === myId);
  const meAfter = next.players.find(p => p.id === myId);

  if (next.status === 'lobby') {
    if (meAfter?.ready && !meBefore?.ready) {
      events.push({ key: 'ready_confirmed' });
    }
    if (isAllReady(next) && !isAllReady(prev)) {
      events.push({ key: 'everyone_ready' });
    }
  }

  // ── Start of play ────────────────────────────────────────────────────────
  const justStarted = prev.status !== 'playing' && next.status === 'playing';
  if (justStarted) events.push({ key: 'game_start' });

  // ── A number was called ──────────────────────────────────────────────────
  const callWasMade = next.callHistory.length > prev.callHistory.length;
  if (callWasMade) {
    const last = next.callHistory[next.callHistory.length - 1];
    const onMyBoard = next.yourBoard?.includes(last.number) ?? false;
    // Mutually exclusive: a mark is the more informative cue, and playing both
    // would stack the 2 s call clip under the 6 s mark clip.
    events.push({ key: onMyBoard ? 'number_marked' : 'number_called' });
  }

  // ── Your progress ────────────────────────────────────────────────────────
  // A line cannot complete without a number being called, so skip the board
  // scan entirely on the many snapshots that only change the roster or a ready
  // flag. Guarding here rather than inside `ownCompletedLineCount` keeps that
  // helper honest for other callers.
  if (
    callWasMade &&
    ownCompletedLineCount(next) > ownCompletedLineCount(prev)
  ) {
    events.push({ key: 'line_complete' });
  }

  // The server's `letters` IS the completed-line count, so this shares an
  // instant with `line_complete`. The offset makes it a second-stage fanfare
  // rather than a muddy overlap.
  //
  // On the line that leaves you one short of winning, `near_win` REPLACES the
  // generic fanfare — three cues on one instant would be noise, and "one away"
  // is the more useful thing to tell the player.
  const myLettersBefore = meBefore?.letters ?? 0;
  const myLettersAfter = meAfter?.letters ?? 0;
  if (myLettersAfter > myLettersBefore) {
    const oneAway = myLettersAfter === next.size - 1;
    events.push({
      key: oneAway ? 'near_win' : 'letter_earned',
      delayMs: LETTER_FANFARE_DELAY_MS,
    });
  }

  // ── Opponent progress ────────────────────────────────────────────────────
  // Same substitution on the other side: an opponent reaching one-away is a
  // threat cue, not just another line.
  let opponentAdvanced = false;
  let opponentOneAway = false;
  for (const after of next.players) {
    if (after.id === myId) continue;
    const before = prev.players.find(p => p.id === after.id);
    if (!before || after.letters <= before.letters) continue;
    opponentAdvanced = true;
    if (after.letters === next.size - 1) opponentOneAway = true;
  }
  if (opponentAdvanced) {
    events.push({ key: opponentOneAway ? 'opponent_near_win' : 'opponent_line' });
  }

  // ── Turn ownership ───────────────────────────────────────────────────────
  const stillPlaying = prev.status === 'playing' && next.status === 'playing';
  const turnMoved = prev.currentTurnSeat !== next.currentTurnSeat;

  // A turn that advanced with no call behind it and no one leaving is the
  // server's turn timer firing. The snapshot carries no `reason`, so this is
  // inferred — but those are the only three ways a turn can move.
  const timedOut =
    turnChangeReason !== undefined
      ? stillPlaying && turnMoved && turnChangeReason === 'timeout'
      : stillPlaying && turnMoved && !callWasMade && !someoneLeft && !someoneJoined;
  if (timedOut) events.push({ key: 'turn_timeout' });

  const mySeat = seatOf(next, myId);
  if (mySeat !== null && next.status === 'playing') {
    const wasMine = prev.status === 'playing' && prev.currentTurnSeat === mySeat;
    const isMine = next.currentTurnSeat === mySeat;

    let delayMs: number | undefined;
    if (justStarted) delayMs = TURN_AFTER_START_DELAY_MS;
    else if (timedOut) delayMs = TURN_AFTER_TIMEOUT_DELAY_MS;

    if (isMine && !wasMine) {
      events.push({ key: 'your_turn', delayMs });
    } else if (!isMine && turnMoved && !justStarted) {
      // `turnMoved` rather than `wasMine`, so a hand-off between two opponents
      // in a 3+ player room still announces itself. Skipped at kickoff, where
      // `game_start` already says it.
      events.push({ key: 'opponent_turn', delayMs });
    }
  }

  return events;
}
