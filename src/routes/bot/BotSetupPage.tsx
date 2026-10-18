import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { GameScreenHeader, OptionSelector } from '@/features/game/components';
import { BOARD_SIZES } from '@/features/game/constants';
import { wordForSize } from '@/features/game/engine';
import type { BoardSize } from '@/features/game/types';
import { useBotConfig } from '@/features/bot/context/botConfig';
import { PATHS } from '../paths';

type FirstTurn = 'human' | 'bot';

/**
 * The only thing standing between Home and a game.
 *
 * Two choices, both with a sensible default, and no room, no code and nobody to
 * wait for. The board size is worth asking because it changes the shape of the
 * whole game — a 3×3 is over in a couple of minutes, an 8×8 is a long one — and
 * because the word you are spelling changes with it.
 */
export function BotSetupPage() {
  const navigate = useNavigate();
  const { config, setConfig } = useBotConfig();
  const [size, setSize] = useState<BoardSize>(config.size);
  const [firstTurn, setFirstTurn] = useState<FirstTurn>(config.firstTurn);

  const headingRef = useAnnounceOnFocus({
    title: 'Play with Bot',
    detail:
      'A single-player game against the computer. Choose a board size and who starts, then lay out your board.',
  });

  const start = () => {
    // Re-keys the game provider on the route below, so every start is a
    // genuinely fresh game with fresh boards and no stray timer.
    setConfig({ size, firstTurn, nonce: config.nonce + 1 });
    navigate(PATHS.botBoardSetup);
  };

  return (
    <PageShell>
      <GameScreenHeader title="Play with Bot" headingRef={headingRef} />

      <OptionSelector<BoardSize>
        label="Board Size"
        value={size}
        onChange={setSize}
        options={BOARD_SIZES.map(option => ({
          value: option,
          label: `${option}×${option}`,
        }))}
        hint={`You will spell ${wordForSize(size)} — one letter for each line you complete.`}
      />

      <OptionSelector<FirstTurn>
        label="Who Starts"
        layout="row"
        value={firstTurn}
        onChange={setFirstTurn}
        options={[
          { value: 'human', label: 'You' },
          { value: 'bot', label: 'Bot' },
        ]}
      />

      <Button fullWidth onClick={start}>
        Start Game
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        The bot plays by the same rules you do. It can only see its own board and
        the numbers everyone has heard called.
      </p>
    </PageShell>
  );
}
