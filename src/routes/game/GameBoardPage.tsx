import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Button, ConfirmDialog, PageShell } from '@/components/ui';
import { announcer } from '@/lib/a11y/Announcer';
import { haptic } from '@/lib/a11y/haptics';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { audioManager } from '@/lib/audio/AudioManager';
import { useAudioChannel } from '@/lib/audio/useAudioChannel';
import {
  AnnouncementCard,
  BingoHeaderRow,
  BoardGrid,
  ConnectionBanner,
  LiveTurnBanner,
  PlayerProgressRow,
  RecentNumbers,
} from '@/features/game/components';
import { useGameSocket } from '@/features/game/context';
import { VoiceBanner, VoiceButton } from '@/features/voice';
import { useGame } from '@/features/game/hooks';
import type { Cell } from '@/features/game/types';
import { PATHS } from '../paths';

/** Described to every cell that could actually be called right now. */
const CELL_HINT = 'Calls this number.';

export function GameBoardPage() {
  const navigate = useNavigate();
  const { error, connection } = useGameSocket();
  const {
    board,
    completedLines,
    progress,
    announcement,
    currentPlayer,
    isMyTurn,
    boardSize,
    recentCalls,
    turnNumber,
    turnEndsAt,
    turnSeconds,
    callNumber,
    leaveRoom,
  } = useGame();

  const sfxOn = useAudioChannel('sfx');
  const [confirmingExit, setConfirmingExit] = useState(false);

  // Leaving mid-game is a forfeit: the server hands the remaining player a
  // walkover win. Worth a confirmation step.
  const exitToHome = useCallback(() => {
    setConfirmingExit(false);
    leaveRoom();
    navigate(PATHS.home, { replace: true });
  }, [leaveRoom, navigate]);

  /**
   * Activating an unmarked cell on your turn sends a call intent.
   *
   * Rejections used to return silently, which is invisible when you cannot see
   * that nothing happened — say why instead.
   */
  const onCellPress = useCallback(
    (cell: Cell) => {
      if (cell.value === null) return;

      if (!isMyTurn) {
        haptic('invalid');
        announcer.speak('Not your turn yet', { assertive: true });
        return;
      }
      if (cell.marked) {
        haptic('invalid');
        announcer.speak(`${cell.value} has already been called`, { assertive: true });
        return;
      }

      callNumber(cell.value);
    },
    [isMyTurn, callNumber],
  );

  const toggleSfx = useCallback(() => audioManager.toggleChannel('sfx'), []);

  /**
   * Arrival announcement and focus parking.
   *
   * `detail` must not depend on whose turn it is: the hook re-runs whenever it
   * changes, which would drag focus off the cell the player is exploring on
   * every single turn. Turn ownership is carried by `LiveTurnBanner` and spoken
   * by the speech bridge.
   */
  const headingRef = useAnnounceOnFocus({
    title: 'Game board',
    detail: `Your ${boardSize} by ${boardSize} board. Move between cells with the arrow keys and press Enter on a number to call it.`,
    key: String(boardSize),
  });

  return (
    <PageShell width="wide">
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Game board
      </h1>

      <ConnectionBanner status={connection} />
      <VoiceBanner />

      {/* Owns the one-second timer, so the tick never reaches the board. */}
      <LiveTurnBanner
        byName={isMyTurn ? 'Your' : `${currentPlayer?.name ?? 'Someone'}'s`}
        turn={turnNumber}
        turnEndsAt={turnEndsAt}
        turnSeconds={turnSeconds}
        isMyTurn={isMyTurn}
      />

      {error ? <Banner variant="error">{error.message}</Banner> : null}

      {/* Board first on a phone, board-beside-rail on a wide screen — the
          progress and call history are reference material, not the main act. */}
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {announcement ? <AnnouncementCard announcement={announcement} /> : null}

          {/* Square board: bound the height, or a small board outgrows the
              viewport and the controls fall below the fold. */}
          <div className="mx-auto flex w-full max-w-[min(36rem,58vh)] flex-col gap-1">
            <BingoHeaderRow size={boardSize} />
            <BoardGrid
              label={`Your board, ${boardSize} by ${boardSize}`}
              cells={board}
              size={boardSize}
              variant="play"
              completedLines={completedLines}
              // Always wired up: gating the handler here would swap each cell
              // between an active and inert control on every turn, which drops
              // focus. Whether a press does anything is decided in
              // `onCellPress`, which also says out loud why it did not.
              onCellPress={onCellPress}
              canActivate={isMyTurn}
              cellHint={CELL_HINT}
            />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {isMyTurn
              ? 'Choose a number on your board to call it.'
              : 'Waiting for the other player…'}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <RecentNumbers numbers={recentCalls} />
          <PlayerProgressRow progress={progress} />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="md"
              className="flex-1 text-rose-400"
              onClick={() => setConfirmingExit(true)}>
              Exit
            </Button>
            <VoiceButton className="flex-1" />
            <Button variant="outline" size="md" className="flex-1" onClick={toggleSfx}>
              {sfxOn ? 'Sound On' : 'Sound Off'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingExit}
        title="Leave the game?"
        message="You will forfeit this match and the other player wins."
        confirmLabel="Leave game"
        destructive
        onConfirm={exitToHome}
        onCancel={() => setConfirmingExit(false)}
      />
    </PageShell>
  );
}
