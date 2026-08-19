/**
 * Ported verbatim from the React Native app: `bingo/src/features/game/a11y/gameSpeechEvents.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

import { plural, sentence } from '@/lib/a11y/phrases';
import type { AudioEvent } from '../audio/gameAudioEvents';
import type { RoomSnapshot } from '../types/events';

/**
 * What to say, derived from the same snapshot diff that decides what to play.
 *
 * Speech and sound are **not** duplicates of one another. The sound cues carry
 * the emotional beat; speech carries the information a sighted player would
 * read off the screen — which number, whose turn, how far along everyone is.
 * Anything a sound already communicates unambiguously (a line completing, a
 * win) gets a short phrase or none, so the player is not told the same thing
 * twice.
 *
 * Pure, like `deriveAudioEvents`, so the whole commentary is testable.
 */

export interface SpeechEvent {
  text: string;
  /** Same scale as the sound registry, so the two stay comparable. */
  priority: number;
  /** Interrupts and clears the queue. Reserve for the end of the game. */
  assertive?: boolean;
  dedupeKey?: string;
}

/** Reuses the audio diff's decisions rather than re-deriving them. */
export interface SpeechContext {
  audioEvents: AudioEvent[];
}

function nameOf(
  snapshot: RoomSnapshot,
  playerId: string | undefined,
  myId: string | undefined,
): string {
  if (playerId === myId) return 'You';
  return snapshot.players.find(p => p.id === playerId)?.name ?? 'Someone';
}

/**
 * Translate a snapshot change into speech.
 *
 * `audioEvents` is passed in rather than recomputed: the audio diff has already
 * decided things like "this call landed on your board", and re-deriving them
 * would both duplicate the board scan and risk the two disagreeing.
 */
export function deriveSpeechEvents(
  prev: RoomSnapshot | null,
  next: RoomSnapshot | null,
  myId: string | undefined,
  { audioEvents }: SpeechContext,
): SpeechEvent[] {
  if (!next || !prev || prev.code !== next.code) return [];

  const fired = new Set(audioEvents.map(event => event.key));
  const events: SpeechEvent[] = [];

  // ── Game over ────────────────────────────────────────────────────────────
  if (fired.has('you_win') || fired.has('you_lose')) {
    const winnerName = nameOf(next, next.winnerId, myId);
    events.push({
      text: fired.has('you_win')
        ? 'You win!'
        : `${winnerName} wins. Better luck next time`,
      priority: 100,
      assertive: true,
    });
    // Nothing else matters once the game is over.
    return events;
  }

  // ── A number was called ──────────────────────────────────────────────────
  if (fired.has('number_called') || fired.has('number_marked')) {
    const last = next.callHistory[next.callHistory.length - 1];
    const caller = nameOf(next, last.playerId, myId);
    const onMyBoard = fired.has('number_marked');
    events.push({
      text: sentence(
        `${caller} called ${last.number}`,
        // The sound already distinguishes hit from miss; this says which cell,
        // which the sound cannot.
        onMyBoard ? 'Marked on your board' : 'Not on your board',
      ),
      priority: 50,
      dedupeKey: `call:${last.number}:${next.callHistory.length}`,
    });
  }

  // ── Progress ─────────────────────────────────────────────────────────────
  const meAfter = next.players.find(p => p.id === myId);

  if (fired.has('near_win')) {
    events.push({
      text: 'One line from winning',
      priority: 68,
      dedupeKey: 'near-win',
    });
  } else if (fired.has('letter_earned')) {
    events.push({
      text: `Line complete. ${plural(meAfter?.letters ?? 0, 'line')} of ${
        next.size
      }`,
      priority: 70,
      dedupeKey: `letters:${meAfter?.letters}`,
    });
  }

  if (fired.has('opponent_near_win')) {
    events.push({
      text: 'An opponent is one line from winning',
      priority: 58,
      dedupeKey: 'opponent-near-win',
    });
  }

  // ── Turn ownership ───────────────────────────────────────────────────────
  if (fired.has('turn_timeout')) {
    events.push({ text: 'Time up', priority: 62, dedupeKey: 'timeout' });
  }

  if (fired.has('your_turn')) {
    events.push({
      text: 'Your turn',
      priority: 60,
      dedupeKey: `turn:${next.callHistory.length}`,
    });
  } else if (fired.has('opponent_turn')) {
    const current = next.players.find(p => p.seat === next.currentTurnSeat);
    events.push({
      text: `${current?.name ?? 'Someone'}'s turn`,
      priority: 35,
      dedupeKey: `turn:${next.callHistory.length}`,
    });
  }

  // ── Room and connection ──────────────────────────────────────────────────
  if (fired.has('player_left')) {
    events.push({ text: 'A player left the room', priority: 40 });
  }
  if (fired.has('player_reconnected')) {
    events.push({ text: 'A player reconnected', priority: 35 });
  }
  if (fired.has('room_closed')) {
    events.push({
      text: 'Not enough players. Back to the lobby',
      priority: 75,
    });
  }
  if (fired.has('everyone_ready')) {
    events.push({ text: 'Everyone is ready', priority: 40 });
  }
  if (fired.has('game_start')) {
    events.push({ text: 'Game started', priority: 80 });
  }

  return events;
}
