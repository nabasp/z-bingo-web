import type { SoundKey } from './soundRegistry';

/**
 * Which clips the game refuses to start without.
 *
 * **Web-only, and deliberately not in `soundRegistry.ts`.** That file is shared
 * verbatim with the mobile app, where the clips live in the app bundle and
 * cannot fail to arrive — "critical" is a distinction that only means anything
 * when a network is involved.
 *
 * The rule for membership is *what the sound tells you that nothing else
 * does*. The speech layer already narrates the call, the turn and the result,
 * so this is not "every sound a blind player relies on" — it is the set whose
 * absence would leave the game feeling broken rather than quiet.
 *
 * Everything else degrades the way it always has: reported on the loading
 * screen, silent in play, and never a reason to block. Holding a player out of
 * a match the server has already started — with a turn clock running — because
 * `room_code_copied.wav` returned a 404 would be worse than the delay this
 * whole system exists to remove.
 */
export const CRITICAL_SOUNDS: ReadonlySet<SoundKey> = new Set<SoundKey>([
  // The core loop: a number is called, and it is or is not on your board.
  'number_called',
  'number_marked',
  // Whose turn it is — the question the game is unplayable without.
  'your_turn',
  'opponent_turn',
  // The clock. `countdown_tick` is the whole end-of-turn warning.
  'countdown_tick',
  'turn_timeout',
  // Progress, which is the only feedback a completed line gets besides speech.
  'line_complete',
  'letter_earned',
  // The two moments the game is played for.
  'you_win',
  'you_lose',
  'game_start',
]);

/** Splits a failure list into the part that blocks and the part that does not. */
export function partitionFailures(failed: readonly SoundKey[]): {
  blocking: SoundKey[];
  tolerable: SoundKey[];
} {
  return {
    blocking: failed.filter(key => CRITICAL_SOUNDS.has(key)),
    tolerable: failed.filter(key => !CRITICAL_SOUNDS.has(key)),
  };
}

/**
 * The clips to fetch before the app opens, and the ones to fetch behind it.
 *
 * Two passes rather than one, because what the player is waiting on and what
 * they will need later are different sets. Nobody needs the lobby chime to
 * sign in — holding the whole app on it means the slowest connection waits for
 * 28 clips when 11 would do.
 *
 * Sequential rather than parallel on purpose: the second pass would otherwise
 * compete with the first for the same connection and push back the only moment
 * that matters, which is when the player can start.
 */
export function splitByUrgency(keys: readonly SoundKey[]): {
  first: SoundKey[];
  rest: SoundKey[];
} {
  return {
    first: keys.filter(key => CRITICAL_SOUNDS.has(key)),
    rest: keys.filter(key => !CRITICAL_SOUNDS.has(key)),
  };
}
