import { list, ordinal, playerName, plural, sentence } from '@/lib/a11y/phrases';
import type { AudioEvent } from '../audio/gameAudioEvents';
import type { RoomSnapshot } from '../types/events';
import { completedLines, toCells } from '../utils';
import { coordOf, lineName, type Notation } from './boardCoords';
import { describeNearStrikes, nearStrikes } from './lineProgress';

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
  /**
   * The coordinate vocabulary, for the line and near-strike wording.
   *
   * Passed in rather than read from the store so this stays pure and directly
   * testable — the same reason `cellLabel` takes it as a prop.
   */
  notation?: Notation;
}

/**
 * The line your last mark completed, if it completed one.
 *
 * Compared against the previous snapshot rather than counted, because "Row 1
 * complete" is the sentence a sighted player reads off the strike overlay and
 * a bare count is not. Only the *new* lines are named: a board with four
 * completed lines must not re-read all four on every call.
 */
function newlyCompleted(
  prev: RoomSnapshot,
  next: RoomSnapshot,
): ReturnType<typeof completedLines> {
  if (!next.yourBoard) return [];
  const before = new Set(
    completedLines(
      toCells(prev.yourBoard, prev.calledNumbers),
      prev.size,
    ).map(line => `${line.type}-${line.index}`),
  );
  return completedLines(
    toCells(next.yourBoard, next.calledNumbers),
    next.size,
  ).filter(line => !before.has(`${line.type}-${line.index}`));
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
  { audioEvents, notation = 'chess' }: SpeechContext,
): SpeechEvent[] {
  if (!next || !prev || prev.code !== next.code) return [];

  const fired = new Set(audioEvents.map(event => event.key));
  const events: SpeechEvent[] = [];

  // ── Game over ────────────────────────────────────────────────────────────
  if (fired.has('you_win') || fired.has('you_lose')) {
    const winnerName = nameOf(next, next.winnerId, myId);
    // Everyone's placing, not only the winner's. "You lost" tells a player
    // nothing about the game they just played; "John wins, you second" does,
    // and it is what the results screen shows them a moment later anyway.
    const standings = [...next.players]
      .sort((a, b) => {
        if (a.id === next.winnerId) return -1;
        if (b.id === next.winnerId) return 1;
        if (b.letters !== a.letters) return b.letters - a.letters;
        return a.seat - b.seat;
      })
      .slice(1)
      .map((player, place) =>
        `${playerName(player.name, player.id === myId)} ${ordinal(place + 2)}`,
      );

    events.push({
      text: sentence(
        fired.has('you_win') ? 'You win' : `${winnerName} wins`,
        standings.length > 0 ? list(standings) : undefined,
      ),
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
    const isMine = last.playerId === myId;
    // Where it landed, leading — that is what a sighted player reads off the
    // board, and what tells a listener whether the call is worth turning
    // towards. There is no coordinate for a number that is not on your board,
    // and one is not invented: the cell is simply left out.
    const cellIndex = onMyBoard
      ? (next.yourBoard?.indexOf(last.number) ?? -1)
      : -1;
    const where =
      cellIndex >= 0 ? `${coordOf(cellIndex, next.size, notation)}, ` : '';
    events.push({
      text: isMine
        ? `${where}${last.number} marked`
        : sentence(
            `${where}${last.number}, called by ${caller}`,
            // The sound already distinguishes hit from miss; this says so in
            // words, which the sound cannot.
            onMyBoard ? 'Marked on your board' : 'Not on your board',
          ),
      priority: 50,
      // Your own call was already announced the moment you pressed Enter, so
      // this echo carries that announcement's key and the announcer drops
      // whichever arrives second. Anyone else's call has no local twin, and is
      // keyed by position in the history so two calls of the same number in a
      // rematch are not mistaken for one.
      dedupeKey: isMine
        ? `called:${last.number}`
        : `call:${last.number}:${next.callHistory.length}`,
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
    const struck = newlyCompleted(prev, next);
    const letters = meAfter?.letters ?? 0;
    const letter = next.word?.[letters - 1];
    events.push({
      // Which line, not just that one happened: a player who cannot see the
      // strike has no other way to learn which of their rows just went, and it
      // is the one fact that changes what they do next.
      text: sentence(
        struck.length > 0
          ? `${list(struck.map(line => lineName(line.type, line.index, notation)))} complete`
          : 'Line complete',
        letter ? `Letter ${letter} earned` : undefined,
        `${plural(letters, 'line')} of ${next.size}`,
      ),
      priority: 70,
      dedupeKey: `letters:${letters}`,
    });
  }

  // ── One cell from a strike ───────────────────────────────────────────────
  // The equaliser: a sighted player spots at a glance that a row needs one
  // more number. Deliberately not the same thing as `near_win` above, which
  // fires one whole *line* from the target word — you can be one cell from a
  // strike on your first turn.
  if (
    (fired.has('number_marked') || fired.has('letter_earned')) &&
    next.yourBoard
  ) {
    const warning = describeNearStrikes(
      nearStrikes(toCells(next.yourBoard, next.calledNumbers), next.size),
      next.size,
      notation,
    );
    if (warning) {
      events.push({
        text: warning,
        priority: 66,
        dedupeKey: `near-strike:${next.calledNumbers.length}`,
      });
    }
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
  if (fired.has('lobby_joined')) {
    // Joins had a sound and no words at all, so a blind host heard a chime and
    // had to guess whether the room was now full.
    const joined = next.players.filter(
      player => !prev.players.some(before => before.id === player.id),
    );
    events.push({
      text: sentence(
        joined.length === 1
          ? `${joined[0].name} joined`
          : `${plural(joined.length, 'player')} joined`,
        `${plural(next.players.length, 'player')} in the room`,
      ),
      priority: 40,
      dedupeKey: `joined:${next.players.length}`,
    });
  }
  if (fired.has('player_left')) {
    const left = prev.players.filter(
      player => !next.players.some(after => after.id === player.id),
    );
    events.push({
      // Named, and with the count: "someone left" leaves a player wondering
      // whether the game can continue, which is the only thing they need.
      text: sentence(
        left.length === 1 ? `${left[0].name} left` : 'A player left the room',
        `${plural(next.players.length, 'player')} remaining`,
      ),
      priority: 40,
      dedupeKey: `left:${next.players.length}`,
    });
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
    const names = next.players.map(player =>
      playerName(player.name, player.id === myId),
    );
    events.push({
      // Who is in and what you are spelling, said once, at the only moment a
      // player can take it in. Both were on screen and in no announcement.
      text: sentence(
        'Game started',
        `${plural(next.players.length, 'player')}: ${list(names)}`,
        next.word ? `Target word ${next.word}` : undefined,
      ),
      priority: 80,
    });
  }

  return events;
}
