import type { GameError } from '../types/events';

/**
 * A server error, still carrying its machine-readable parts.
 *
 * The emit helpers reject on failure, and a plain `Error` throws away
 * everything but the sentence — which is exactly the part a screen cannot act
 * on. `already_in_room` is the case that forced this: the message tells the
 * player they are already somewhere, and `details.roomCode` is what lets the
 * UI offer to take them there.
 */
export class GameRequestError extends Error {
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(error: GameError) {
    super(error.message);
    this.name = 'GameRequestError';
    this.code = error.code;
    this.details = error.details;
  }
}
