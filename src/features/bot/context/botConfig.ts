import { createContext, useContext } from 'react';
import type { BoardSize } from '@/features/game';

export interface BotConfig {
  size: BoardSize;
  firstTurn: 'human' | 'bot';
  /**
   * Bumped on every Start Game.
   *
   * Part of the provider's key, so starting again at the same board size is
   * still a genuinely new game — fresh boards, empty call list, and the
   * previous game's pending bot move cancelled by the unmount rather than by
   * anybody remembering to cancel it.
   */
  nonce: number;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  size: 5,
  firstTurn: 'human',
  nonce: 0,
};

/**
 * The settings the setup screen chooses, held by the navigator above it.
 *
 * The game provider wraps the whole bot stack, so the screen that picks the
 * board size sits *inside* what it is configuring. This is the way back up.
 * Changing it re-keys the provider, which starts a genuinely new game rather
 * than mutating one in progress.
 */
export const BotConfigContext = createContext<{
  config: BotConfig;
  setConfig: (config: BotConfig) => void;
}>({ config: DEFAULT_BOT_CONFIG, setConfig: () => {} });

export function useBotConfig() {
  return useContext(BotConfigContext);
}
