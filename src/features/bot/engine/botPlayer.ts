/**
 * What the bot calls on its turn — and the guarantee that it plays fair.
 *
 * Ported verbatim from the React Native app:
 * `bingo-react-native/src/features/bot/engine/botPlayer.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 *
 * ## The fairness boundary
 *
 * **This module is the bot's entire decision surface, and the human's board is
 * not a parameter of it.** That is the mechanism, not a promise: there is no
 * argument to read, this file imports nothing that could reach game state, and
 * the provider that calls it has only these two values to hand it. A future
 * change that wanted to peek at the human's board would have to widen this
 * signature, which is a visible thing to do in review rather than an invisible
 * one.
 *
 * The bot therefore cannot know the human's numbers, their marked cells, how
 * many lines they have, or how close they are to winning — because none of that
 * is reachable from here.
 *
 * ## Why the choice is uniformly random
 *
 * A human calls a number off their own board with no idea what it does to
 * anyone else's, and that is exactly what this does. Note what makes it
 * genuinely fair rather than merely blind: every board is a permutation of
 * 1..n², so *every* number is on *every* board. The bot's own board gives it no
 * information the human does not also have, and a random pick is statistically
 * indistinguishable from a person choosing.
 *
 * Deliberately not implemented: any heuristic at all, including a legitimate
 * own-board one like "prefer a number that finishes my own line". It would be
 * within the rules, but a random bot is the one whose fairness is obvious on
 * reading, and difficulty is not what this mode is for. If a stronger bot is
 * ever wanted, this function — and only this function — is where it goes.
 */

/**
 * A number for the bot to call, or null when it has none left.
 *
 * @param botBoard      The bot's own board. The only board it can see.
 * @param calledNumbers Numbers already called, which every player can see.
 * @param rng           Injectable so tests can assert the choice rather than hope.
 */
export function chooseBotCall(
  botBoard: readonly number[],
  calledNumbers: readonly number[],
  rng: () => number = Math.random,
): number | null {
  const called = new Set(calledNumbers);
  const available = botBoard.filter(value => !called.has(value));
  if (available.length === 0) return null;
  return available[Math.floor(rng() * available.length)];
}
