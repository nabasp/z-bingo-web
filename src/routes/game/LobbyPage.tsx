import { useNavigate } from 'react-router-dom';
import { Banner, Button, PageShell } from '@/components/ui';
import { spokenRoomCode } from '@/lib/a11y/phrases';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { VoiceBanner, VoiceButton } from '@/features/voice';
import {
  ConnectionBanner,
  GameScreenHeader,
  OptionSelector,
  PlayerList,
  RoomCodeCard,
} from '@/features/game/components';
import { BOARD_SIZES, TURN_TIMER_OPTIONS, turnTimerLabel } from '@/features/game/constants';
import { useGameSocket } from '@/features/game/context';
import { useLobby } from '@/features/game/hooks';
import type { BoardSize } from '@/features/game/types';
import { PATHS } from '../paths';

export function LobbyPage() {
  const navigate = useNavigate();
  const { error, clearError, connection } = useGameSocket();
  const {
    room,
    players,
    maxPlayers,
    boardSize,
    turnSeconds,
    isHost,
    youReady,
    allReady,
    canStart,
    toggleReady,
    setSize,
    setTurnSeconds,
    startGame,
    leaveRoom,
  } = useLobby();

  const code = room?.code ?? '';

  // Reading the code out on arrival is the whole point of the lobby for a blind
  // host — it is what they have to relay to the other player.
  const headingRef = useAnnounceOnFocus({
    title: 'Game lobby',
    detail: `Room code ${spokenRoomCode(code)}. ${players.length} of ${maxPlayers} players joined.`,
    key: `${code}:${players.length}`,
  });

  const leave = () => {
    leaveRoom();
    navigate(PATHS.home, { replace: true });
  };

  return (
    <PageShell width="wide">
      <GameScreenHeader title="Game Lobby" showBack={false} headingRef={headingRef} />

      <ConnectionBanner status={connection} />
      <VoiceBanner />

      {error ? (
        <Banner variant="error" onDismiss={clearError}>
          {error.message}
        </Banner>
      ) : null}

      {/* One column on a phone; on desktop the roster sits beside the controls
          rather than a metre below them. */}
      <div className="grid w-full gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <RoomCodeCard code={code} />
          <PlayerList players={players} maxPlayers={maxPlayers} boardSize={boardSize} />
        </div>

        <div className="flex flex-col gap-6">
          {isHost ? (
            <>
              <OptionSelector<BoardSize>
                label="Board Size"
                value={boardSize as BoardSize}
                onChange={setSize}
                options={BOARD_SIZES.map(size => ({
                  value: size,
                  label: `${size}×${size}`,
                }))}
              />
              <OptionSelector<number>
                label="Turn Timer"
                value={turnSeconds}
                onChange={setTurnSeconds}
                options={TURN_TIMER_OPTIONS.map(s => ({
                  value: s,
                  label: turnTimerLabel(s),
                }))}
              />
            </>
          ) : null}

          <div className="flex w-full flex-col gap-4">
            <Button
              fullWidth
              variant={youReady ? 'outline' : 'default'}
              onClick={toggleReady}>
              {youReady ? 'Not Ready' : 'Ready'}
            </Button>
            {isHost ? (
              <Button fullWidth disabled={!canStart} onClick={startGame}>
                {allReady ? 'Start Game' : 'Waiting for players…'}
              </Button>
            ) : null}
            {/* Audio starts in the lobby: this is where players sort out who
                is playing, which is exactly when talking is most useful. */}
            <VoiceButton className="w-full" />
            <Button variant="outline" fullWidth onClick={leave}>
              Leave Room
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
