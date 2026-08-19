import { useContext } from 'react';
import { GameSocketContext, type GameSocketValue } from './gameSocketContext';

/** Access live room state and the emit helpers. */
export function useGameSocket(): GameSocketValue {
  const ctx = useContext(GameSocketContext);
  if (!ctx) {
    throw new Error('useGameSocket must be used within a GameSocketProvider');
  }
  return ctx;
}
