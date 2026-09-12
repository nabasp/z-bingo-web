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
import { useBoardFocusShortcut, useBoardReadouts, useBoardSetup } from '@/features/game/hooks';
import { BOARD_GRID_ID } from '@/features/game/constants';
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
  `Press ${SHORTCUTS.focusBoard.spoken} to jump to the board and back, ` +
  `${SHORTCUTS.toggleMic.spoken} to mute or unmute. ` +
  // Laying out a board you cannot see is the one place reading the whole thing
  // back matters most, so P is named here rather than left to be discovered.
  `On the board, press P to hear the whole board read back, or ? for the rest ` +
  `of the keys.`;

export function BoardSetupPage() {
  const { room, error, connection, leaveRoom } = useGameSocket();
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
    onCellPress,
    isComplete,
    submitted,
    submit,
  } = useBoardSetup(size);

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
        />
      </div>

      <div className="mx-auto flex w-full max-w-[min(32rem,60vh)]">
        {/* Shuffle rearranges what you have placed; it never invents a number,
            so it is useful on a part-filled board too. */}
        <Button
          variant="outline"
          size="md"
          fullWidth
          disabled={submitted}
          onClick={shuffle}>
          Shuffle
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
          Leave Room
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
        title="Leave the room?"
        message="The other players will be left waiting, and the game cannot start without you."
        confirmLabel="Leave room"
        destructive
        onConfirm={leave}
        onCancel={() => setConfirmingLeave(false)}
      />
    </PageShell>
  );
}
