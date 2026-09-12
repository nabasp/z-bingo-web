/**
 * How long the bot waits before it plays.
 *
 * Ported verbatim from the React Native app:
 * `bingo-react-native/src/features/bot/engine/botTiming.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * **Why there is a delay at all.** An opponent that answers instantly, every
 * time, reads as a machine and gives a player no beat in which to take in what
 * just happened — which matters most to somebody listening to the game rather
 * than watching it, since the announcement of their own call would be stepped
 * on by the bot's.
 *
 * **Why it lands on the turn and not on marking.** The brief describes a bot
 * that hears a number and then marks it after a pause. This game has no such
 * step: a call marks the cell on every board at once, derived from the called
 * numbers, and the bot's board is not even on screen. Its turn is the only
 * moment it acts, so that is where the thinking time goes.
 */

/** The window the bot's pause is drawn from. */
export const BOT_MIN_DELAY_MS = 900;
export const BOT_MAX_DELAY_MS = 2200;

/**
 * A pause, uniformly random within the window.
 *
 * Random rather than fixed so the bot never falls into a rhythm — a constant
 * delay is just as robotic as none, only slower.
 */
export function botDelayMs(rng: () => number = Math.random): number {
  return Math.round(
    BOT_MIN_DELAY_MS + rng() * (BOT_MAX_DELAY_MS - BOT_MIN_DELAY_MS),
  );
}
