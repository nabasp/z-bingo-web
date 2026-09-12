import { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { BotGameProvider } from '@/features/bot';
import {
  BotConfigContext,
  DEFAULT_BOT_CONFIG,
  useBotConfig,
  type BotConfig,
} from '@/features/bot/context/botConfig';
import { useGameFlowNavigation } from '@/features/game/hooks';

/**
 * Holds the settings the setup page chooses.
 *
 * Pathless, and a parent of both the picker and the game itself, because the
 * picker sits above the provider it is configuring — there is nowhere else the
 * two can meet.
 */
export function BotConfigLayout() {
  const [config, setConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const value = useMemo(() => ({ config, setConfig }), [config]);

  return (
    <BotConfigContext.Provider value={value}>
      <Outlet />
    </BotConfigContext.Provider>
  );
}

function BotFlow() {
  useGameFlowNavigation();
  return <Outlet />;
}

/**
 * The game itself, on the device.
 *
 * Deliberately **not** `GameLayout`: that one mounts `VoiceProvider`, which
 * asks the server for a LiveKit token, and its flow navigation targets the
 * `/game/*` routes — either would drag a bot game out of this mode. The flow
 * hook runs here instead, inside the provider, where it reads `mode === 'bot'`
 * and navigates within these routes.
 *
 * Mounting only over the game routes is what makes cleanup automatic: leaving
 * for Home unmounts the provider, and with it any move the bot had scheduled.
 */
export function BotGameLayout() {
  const { config } = useBotConfig();

  return (
    // Keyed on the settings, so starting again — even at the same board size —
    // is a genuinely new game rather than a mutated old one.
    <BotGameProvider
      key={`${config.size}-${config.firstTurn}-${config.nonce}`}
      size={config.size}
      firstTurn={config.firstTurn}>
      <BotFlow />
    </BotGameProvider>
  );
}
