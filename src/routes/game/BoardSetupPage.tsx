import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  ConfirmDialog,
  PageHeading,
  PageShell,
} from '@/components/ui';
import { SHORTCUTS } from '@/lib/a11y/shortcuts';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import {
  BingoHeaderRow,
  BoardGrid,
  ConnectionBanner,
} from '@/features/game/components';
import { useGameSocket } from '@/features/game/context';
import { useGameMode } from '@/features/game/mode';
import { useBoardFocusShortcut, useBoardReadouts, useBoardSetup } from '@/features/game/hooks';
import { BOARD_GRID_ID } from '@/features/game/constants';
import { useMicToggleAction } from '@/features/voice';
import type { BoardSize } from '@/features/game/types';
import { PATHS } from '../paths';

/**
 * Described to every editable cell.
 *
 * Fixed wording rather than one that tracks the pending selection: a hint that
 * changed on every pick would change identity for all N² cells and re-render
 * the whole grid.
 */
const CELL_HINT =
  'Press Enter on an empty cell to place the next number, or on a filled one to clear it.';

/**
 * Read out on arrival, and shown to browse-mode users just above the board.
 *
 * A module constant so the two copies cannot drift and `detail` keeps a stable
 * identity — the hook re-parks focus whenever it changes.
 *
 * No Escape here: this page has no confirmed exit, and wiring it to an
 * unconfirmed one would be worse than leaving the key alone.
 */
const KEYBOARD_HELP =
  `Choose cells in any order to place the numbers 1 upwards, then choose Continue. ` +
  `Choose a filled cell to clear it. ` +
  `Move between cells with the arrow keys. ` +
  // Worth naming up front rather than leaving to be found by Tabbing: on a
  // large board this is the difference between four presses and sixty-four.
  `Random Fill places the numbers you have not placed yet, leaving the ones ` +
  `you have chosen where they are. ` +
  `Press ${SHORTCUTS.focusBoard.spoken} to jump to the board and back, ` +
  `${SHORTCUTS.toggleMic.spoken} to mute or unmute. ` +
  // Laying out a board you cannot see is the one place reading the whole thing
  // back matters most, so P is named here rather than left to be discovered.
  `On the board, press P to hear the whole board read back, F to fill the rest ` +
  `at random, U to undo, or H for the rest of the keys.`;

export function BoardSetupPage() {
  const { room, error, connection, leaveRoom } = useGameSocket();
  // Nobody is kept waiting by a bot game, so leaving one costs something else.
  const isBotGame = useGameMode() === 'bot';
  const navigate = useNavigate();
  const size = (room?.size ?? 5) as BoardSize;
  // The word this board spells — BUS at 3×3, GAME at 4×4, BINGO at 5×5, and so
  // on. Chosen by the server, so every client shows the same one.
  const word = room?.word ?? '';
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const leave = useCallback(() => {
    setConfirmingLeave(false);
    leaveRoom();
    navigate(PATHS.home, { replace: true });
  }, [leaveRoom, navigate]);

  const headingRef = useAnnounceOnFocus({
    title: 'Set up your board',
    detail: `A ${size} by ${size} board. ${KEYBOARD_HELP}`,
    key: String(size),
  });

  // Alt+B jumps into the board and back out to wherever the player was.
  useBoardFocusShortcut({ gridId: BOARD_GRID_ID, fallbackRef: headingRef });

  const {
    cells,
    nextNumber,
    remaining,
    shuffle,
    fillRandom,
    undo,
    canUndo,
    onCellPress,
    isComplete,
    submitted,
    submit,
  } = useBoardSetup(size);

  // The bare `M` inside the grid, doing exactly what Alt+M does outside it.
  // Without this the key was matched, swallowed and silent on this page while
  // the spoken help cheerfully announced it.
  const onToggleMic = useMicToggleAction();

  /**
   * The same readouts as during play, minus the ones that mean nothing yet.
   *
   * Laying out a board by ear is the hardest part of the game to do blind —
   * you are building an arrangement you cannot see and will have to navigate
   * from memory. Being able to ask for the whole board back is what makes that
   * checkable before it is locked in.
   */
  const onBoardAction = useBoardReadouts({
    cells,
    size,
    players: room?.players ?? [],
    myId: undefined,
    // Nothing is ever marked while the board is being laid out, so the row,
    // column and diagonal readouts answer about cells that are still blank.
    basis: 'filled',
  });

  return (
    <PageShell>
      <PageHeading
        headingRef={headingRef}
        title="Set Up Your Board"
        subtitle="Choose cells in any order to place the numbers."
      />

      <ConnectionBanner status={connection} />

      {error ? <Banner variant="error">{error.message}</Banner> : null}

      {/*
        The board is square, so capping only its width lets a small board grow
        until it is taller than the viewport — a 3x3 filled the whole screen and
        pushed the tools below the fold. `60vh` bounds the height instead, which
        is what actually matters here.
      */}
      <div className="mx-auto flex w-full max-w-[min(32rem,60vh)] flex-col gap-1">
        {/* For browse-mode readers arrowing down to the board. */}
        <p className="sr-only">{KEYBOARD_HELP}</p>

        <BingoHeaderRow word={word} />
        <BoardGrid
          id={BOARD_GRID_ID}
          label={`Your board, ${size} by ${size}`}
          cells={cells}
          size={size}
          variant="setup"
          onCellPress={onCellPress}
          canActivate={!submitted}
          cellHint={CELL_HINT}
          onBoardAction={onBoardAction}
          onToggleMic={onToggleMic}
          onRandomFill={fillRandom}
          onUndo={undo}
        />
      </div>

      <div className="mx-auto flex w-full max-w-[min(32rem,60vh)] gap-3">
        {/* Both rearrange rather than deal: Shuffle moves only the numbers you
            have placed, Random Fill drops the remaining ones into the cells you
            have left. Neither disturbs a cell you chose deliberately. */}
        <Button
          variant="outline"
          size="md"
          fullWidth
          disabled={submitted}
          onClick={shuffle}>
          Shuffle
        </Button>
        <Button
          variant="outline"
          size="md"
          fullWidth
          disabled={submitted || isComplete}
          onClick={fillRandom}>
          Random Fill
        </Button>
        {/* Undo is the only way to take back a Shuffle or a Random Fill, which
            move cells the player never chose one by one. A button as well as a
            key, so it is not reachable by keyboard alone. */}
        <Button
          variant="outline"
          size="md"
          fullWidth
          disabled={!canUndo}
          onClick={undo}>
          Undo
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-[min(32rem,60vh)] flex-col gap-3">
        <Button fullWidth disabled={!isComplete || submitted} onClick={submit}>
          {submitted ? 'Board Locked' : 'Continue'}
        </Button>

        {/* There was no way out of this screen before: a player who changed
            their mind while laying out a board had to close the app. Confirmed,
            because leaving ends the game for everyone waiting on them. */}
        <Button
          variant="outline"
          fullWidth
          className="text-rose-400"
          onClick={() => setConfirmingLeave(true)}>
          {isBotGame ? 'Leave Game' : 'Leave Room'}
        </Button>

        {/*
          Announced on every change, so a player who cannot see the board still
          knows which number lands next and how much is left. Saying the number
          is what makes "choose a cell" a complete instruction rather than half
          of one.
        */}
        <p role="status" aria-live="polite" className="text-center text-sm text-muted-foreground">
          {submitted
            ? 'Board locked in. Waiting for the other players.'
            : isComplete
              ? 'Board full. Choose Continue, or choose a cell to clear it.'
              : `Choose a cell to place ${nextNumber}. ${remaining} ${
                  remaining === 1 ? 'cell' : 'cells'
                } left.`}
        </p>

        {!isComplete ? (
          <p className="text-center text-sm text-muted-foreground">
            Fill every cell to continue.
          </p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmingLeave}
        title={isBotGame ? 'Leave this game?' : 'Leave the room?'}
        message={
          isBotGame
            ? 'The board you have laid out will be discarded.'
            : 'The other players will be left waiting, and the game cannot start without you.'
        }
        confirmLabel="Leave room"
        destructive
        onConfirm={leave}
        onCancel={() => setConfirmingLeave(false)}
      />
    </PageShell>
  );
}
