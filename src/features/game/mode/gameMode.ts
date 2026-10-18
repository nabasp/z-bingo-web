import { createContext, useContext } from 'react';

/**
 * Which kind of game the screens below are rendering.
 *
 * A handful of things a board screen says and does are true of a multiplayer
 * room and not of a game against the bot: where the flow navigates as the
 * status changes, what leaving costs, and whether there is anybody to talk to.
 * Rather than fork the screens — which would mean two copies of the board, the
 * setup flow and the result page drifting apart — they read this.
 *
 * Defaults to `'multiplayer'`, so every existing mount behaves exactly as it
 * did without being touched.
 */
export type GameMode = 'multiplayer' | 'bot';

export const GameModeContext = createContext<GameMode>('multiplayer');

export function useGameMode(): GameMode {
  return useContext(GameModeContext);
}
