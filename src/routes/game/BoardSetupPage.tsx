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
import { useBoardFocusShortcut, useBoardSetup } from '@/features/game/hooks';
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
  'Press Enter to pick this cell, then Enter on another to swap them.';

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
  `Use Random Fill, then swap cells to taste, then choose Continue. ` +
  `Move between cells with the arrow keys. ` +
  `Press ${SHORTCUTS.focusBoard.spoken} to jump to the board and back, ` +
  `${SHORTCUTS.toggleMic.spoken} to mute or unmute.`;

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
    selectedIndex,
    randomFill,
    shuffle,
    reset,
    onCellPress,
    isComplete,
    submitted,
    submit,
  } = useBoardSetup(size);

  return (
    <PageShell>
      <PageHeading
        headingRef={headingRef}
        title="Set Up Your Board"
        subtitle="Use Random Fill or Shuffle, then pick two cells to swap."
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
          selectedIndex={selectedIndex}
          onCellPress={onCellPress}
          canActivate={!submitted}
          cellHint={CELL_HINT}
        />
      </div>

      <div className="mx-auto flex w-full max-w-[min(32rem,60vh)] gap-2">
        <Button variant="outline" size="md" className="flex-1" disabled={submitted} onClick={reset}>
          Reset
        </Button>
        <Button variant="outline" size="md" className="flex-1" disabled={submitted} onClick={randomFill}>
          Random Fill
        </Button>
        <Button variant="outline" size="md" className="flex-1" disabled={submitted} onClick={shuffle}>
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

        <p role="status" aria-live="polite" className="text-center text-sm text-muted-foreground">
          {submitted
            ? 'Board locked in. Waiting for the other players.'
            : selectedIndex !== null
              ? 'Now choose a second cell to swap the two.'
              : isComplete
                ? 'Pick any two cells to swap them, or choose Continue.'
                : 'Choose Random Fill to place your numbers.'}
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
