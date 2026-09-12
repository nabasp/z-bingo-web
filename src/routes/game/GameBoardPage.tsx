import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Button, ConfirmDialog, PageShell } from '@/components/ui';
import { announcer, TIER } from '@/lib/a11y/Announcer';
import { haptic } from '@/lib/a11y/haptics';
import { getNotation } from '@/lib/a11y/notation';
import { BOARD_KEYS, SHORTCUTS } from '@/lib/a11y/shortcuts';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { useShortcut } from '@/lib/a11y/useShortcut';
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
import { useMicToggleAction, VoiceBanner, VoiceButton } from '@/features/voice';
import {
  useBoardFocusShortcut,
  useBoardReadouts,
  useGame,
} from '@/features/game/hooks';
import { coordOf } from '@/features/game/a11y/boardCoords';
import { BOARD_GRID_ID } from '@/features/game/constants';
import type { Cell } from '@/features/game/types';
import { PATHS } from '../paths';

/** Described to every cell that could actually be called right now. */
const CELL_HINT = 'Calls this number.';

/**
 * Read out on arrival, and shown to browse-mode users just above the board.
 *
 * A module constant so the announcement and the on-page text cannot drift, and
 * so `useAnnounceOnFocus`'s `detail` keeps a stable identity — it re-parks focus
 * whenever it changes, which would drag a player off the cell they were
 * exploring.
 */
const KEYBOARD_HELP =
  `Move between cells with the arrow keys and press Enter on a number to call it. ` +
  `Press ${SHORTCUTS.focusBoard.spoken} to jump to the board and back, ` +
  `${SHORTCUTS.toggleMic.spoken} to mute or unmute, ` +
  `${SHORTCUTS.exitGame.spoken} to leave the game. ` +
  // Built from the same table the grid binds from, so the help cannot name a
  // key the board does not answer.
  `On the board, single keys ask it questions: ${BOARD_KEYS.map(
    spec => `${spec.spoken} for ${spec.description.replace(/\.$/, '')}`,
  ).join(', ')}.`;

export function GameBoardPage() {
  const navigate = useNavigate();
  const { error, connection } = useGameSocket();
  const {
    board,
    completedLines,
    seatedPlayers,
    me,
    progress,
    announcement,
    currentPlayer,
    isMyTurn,
    boardSize,
    word,
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
      // Said here rather than waiting for the server's snapshot to echo back:
      // a confirmation that arrives a round trip late reads as lag, and the
      // player has usually moved on. The echo carries the same `dedupeKey`, so
      // whichever lands second is dropped and the number is never said twice.
      announcer.speak(
        `${coordOf(cell.index, boardSize, getNotation())}, ${cell.value} called`,
        { ...TIER.interrupt, dedupeKey: `called:${cell.value}`, dedupeMs: 4000 },
      );
    },
    [isMyTurn, callNumber, boardSize],
  );

  /** Answers P / R / C / D / X / S, asked from the focused cell. */
  const onBoardAction = useBoardReadouts({
    cells: board,
    size: boardSize,
    players: seatedPlayers,
    myId: me?.id,
  });

  // The bare `M` inside the grid, doing exactly what Alt+M does outside it.
  const onToggleMic = useMicToggleAction();

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
    detail: `Your ${boardSize} by ${boardSize} board. ${KEYBOARD_HELP}`,
    key: String(boardSize),
  });

  // Alt+B jumps into the board and back out to wherever the player was.
  useBoardFocusShortcut({ gridId: BOARD_GRID_ID, fallbackRef: headingRef });

  // Escape asks before leaving: going mid-game forfeits the match. The hook
  // ignores the key while a dialog is open, so pressing it again dismisses the
  // confirmation rather than reopening it.
  useShortcut(SHORTCUTS.exitGame.chord, () => setConfirmingExit(true));

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
            {/* Read by browse-mode screen-reader users arrowing down the page,
                which is where they meet the board. Not `aria-describedby` on
                the grid: that container is never focused, and the cells already
                use their description for the per-cell hint. */}
            <p className="sr-only">{KEYBOARD_HELP}</p>

            <BingoHeaderRow word={word} earned={completedLines.length} />
            <BoardGrid
              id={BOARD_GRID_ID}
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
              onBoardAction={onBoardAction}
              onToggleMic={onToggleMic}
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
