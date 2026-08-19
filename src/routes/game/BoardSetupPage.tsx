import { Banner, Button, PageHeading, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import {
  BingoHeaderRow,
  BoardGrid,
  ConnectionBanner,
} from '@/features/game/components';
import { useGameSocket } from '@/features/game/context';
import { useBoardSetup } from '@/features/game/hooks';
import type { BoardSize } from '@/features/game/types';

/**
 * Described to every editable cell.
 *
 * Fixed wording rather than one that tracks the pending selection: a hint that
 * changed on every pick would change identity for all N² cells and re-render
 * the whole grid.
 */
const CELL_HINT =
  'Press Enter to pick this cell, then Enter on another to swap them.';

export function BoardSetupPage() {
  const { room, error, connection } = useGameSocket();
  const size = (room?.size ?? 5) as BoardSize;

  const headingRef = useAnnounceOnFocus({
    title: 'Set up your board',
    detail: `A ${size} by ${size} board. Use Random Fill, then swap cells to taste, then choose Continue. Move between cells with the arrow keys.`,
    key: String(size),
  });

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
        <BingoHeaderRow size={size} />
        <BoardGrid
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
    </PageShell>
  );
}
