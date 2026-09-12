import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { cn } from '@/lib/cn';
import { announcer, TIER } from '@/lib/a11y/Announcer';
import { describeBoardKeys } from '@/lib/a11y/shortcuts';
import { useNotation } from '@/lib/a11y/notation';
import { audioManager } from '@/lib/audio/AudioManager';
import type { Cell, LineDescriptor } from '../types';
import { cellLabel, type BoardVariant } from '../a11y/cellLabel';
import type { Notation } from '../a11y/boardCoords';
import { BOARD_ACTIONS, type BoardActionName } from '../a11y/boardActions';
import { edgeNameAt, type ArrowKey } from '../a11y/edges';

/** Spacing between cells, in px. Must match the `gap` used by the grid. */
const CELL_GAP = 4;

/** Thickness of a completed-line strike, in px. */
const STRIKE_WIDTH = 5;

/** How far a strike overhangs the centres of the end cells, as a cell fraction. */
const STRIKE_OVERHANG = 0.5;

export interface BingoHeaderRowProps {
  /** The word this board spells, from the server. Length always equals `size`. */
  word: string;
  /**
   * How many letters are earned — one per completed line.
   *
   * Struck through as they are won, which is the whole point of the word: it
   * is the progress bar of a bingo game. Defaults to none, for setup.
   */
  earned?: number;
}

/**
 * The word a player spells by completing lines.
 *
 * The word comes from the server (`RoomSnapshot.word`) rather than a constant
 * here, because it differs per board size — BUS at 3×3, GAME at 4×4, BINGO at
 * 5×5, and so on up to CHAMPION. This used to hardcode "BINGO" and render
 * nothing at all for any other size, which quietly removed the feature from
 * every board that was not 5×5.
 */
export const BingoHeaderRow = memo(function BingoHeaderRow({
  word,
  earned = 0,
}: BingoHeaderRowProps) {
  if (!word) return null;
  const letters = word.split('');
  // A 5×5 has twelve possible lines but only five letters, so the raw count can
  // overshoot. Clamped here rather than at each call site, or the spoken label
  // ends up saying "twelve of five letters complete".
  const struck = Math.min(earned, letters.length);

  return (
    // One node, not one per letter: five separate screen-reader stops spelling
    // out B-I-N-G-O tell a player nothing they can act on, and column identity
    // already lives in each cell's own label. The progress *is* worth saying,
    // so the row carries a single composed label instead of being hidden.
    <div
      role="status"
      aria-label={`${word}. ${struck} of ${letters.length} letters complete.`}
      className="grid w-full"
      style={{ gridTemplateColumns: `repeat(${letters.length}, minmax(0, 1fr))`, gap: CELL_GAP }}>
      {letters.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          aria-hidden="true"
          className={cn(
            'py-1.5 text-center text-base font-bold transition-colors',
            index < struck
              ? 'text-primary line-through decoration-2'
              : 'text-muted-foreground',
          )}>
          {letter}
        </span>
      ))}
    </div>
  );
});

/**
 * Number text sized to the board.
 *
 * The mobile app steps through fixed Tailwind sizes because its board is
 * pinned to the screen width. Here the grid is fluid, so the type scales with
 * it — `cqw` units resolve against the board's own width, which is what keeps
 * an 8×8 legible on a phone and comfortable on a monitor.
 */
function cellFontSize(size: number): string {
  if (size <= 4) return 'clamp(0.95rem, 7cqw, 1.6rem)';
  if (size <= 6) return 'clamp(0.8rem, 5.5cqw, 1.35rem)';
  return 'clamp(0.65rem, 4.5cqw, 1.1rem)';
}

export interface BoardCellProps {
  index: number;
  value: number | null;
  size: number;
  variant: BoardVariant;
  /** Called on this board. Authoritative, and never overridden by anything. */
  marked: boolean;
  /** Setup only: picked for a swap. A separate concept from `marked`. */
  selected: boolean;
  inCompletedLine: boolean;
  /** Whether activating this cell would actually do something right now. */
  actionable: boolean;
  /** The id of the element describing what activation does. */
  hintId?: string;
  /** Roving tabindex: exactly one cell in the grid is tabbable. */
  tabbable: boolean;
  /** The player's coordinate vocabulary. A primitive, so `memo` still holds. */
  notation: Notation;
  /** Must be referentially stable, or memoization here is pointless. */
  onActivate: (index: number) => void;
  onFocusCell: (index: number) => void;
}

/**
 * A single square board cell — and one accessibility node.
 *
 * Props are deliberately primitives rather than the `Cell` object: `toCells`
 * rebuilds every cell on each snapshot, so an object prop would change identity
 * every render and defeat `memo` entirely. The label is built *here*, inside
 * the memo boundary, so the parent never constructs N² strings per render.
 *
 * `marked` and `selected` are separate props on purpose. In the mobile app they
 * were once collapsed into one `highlighted` boolean fed by an optional Set, and
 * a defined-but-empty Set silently masked every mark — which is precisely how
 * turning TalkBack on unmarked the whole board.
 *
 * Note what is **absent**: `disabled`. A disabled button is skipped by keyboard
 * navigation and refused activation by assistive tech, which would silence the
 * spoken "already called" / "not your turn" rejections that exist precisely
 * because silence is invisible. Actionability rides on the hint instead.
 */
export const BoardCell = memo(function BoardCell({
  index,
  value,
  size,
  variant,
  marked,
  selected,
  inCompletedLine,
  actionable,
  hintId,
  tabbable,
  notation,
  onActivate,
  onFocusCell,
}: BoardCellProps) {
  const handleClick = useCallback(() => onActivate(index), [onActivate, index]);
  const handleFocus = useCallback(() => onFocusCell(index), [onFocusCell, index]);

  // Selection only exists during setup and marking only during play, so the
  // two can never contend — but the precedence is explicit rather than implied.
  const highlighted = selected || marked;

  return (
    <button
      type="button"
      // `gridcell` rather than `button`: the grid is the structure a screen
      // reader user navigates, and the position is already the first thing the
      // label says. It stays a native <button>, so Enter and Space activate it.
      role="gridcell"
      data-index={index}
      tabIndex={tabbable ? 0 : -1}
      onClick={handleClick}
      onFocus={handleFocus}
      aria-label={cellLabel({
        index,
        size,
        value,
        variant,
        marked,
        selected,
        inCompletedLine,
        notation,
      })}
      // Only offered when doing it is actually possible; an affordance you
      // cannot use is worse than none.
      aria-describedby={actionable ? hintId : undefined}
      aria-selected={variant === 'setup' ? selected : undefined}
      className={cn(
        'flex aspect-square items-center justify-center rounded-lg border font-semibold',
        'transition-colors select-none',
        highlighted
          ? 'border-primary bg-primary text-primary-foreground'
          : value !== null
            ? 'border-border bg-card text-foreground hover:border-ring'
            : 'border-border bg-background text-foreground',
      )}
      style={{ fontSize: cellFontSize(size) }}>
      {value ?? ''}
    </button>
  );
});

/**
 * A bar drawn through the centres of a completed line's end cells.
 *
 * Cells are square and evenly pitched, so every centre is derivable from the
 * measured grid width — one rotated bar covers rows, columns and both
 * diagonals. Same geometry as the mobile `LineStrike`; the measurement comes
 * from a `ResizeObserver` rather than `onLayout`.
 */
const LineStrike = memo(function LineStrike({
  line,
  size,
  gridWidth,
}: {
  line: LineDescriptor;
  size: number;
  gridWidth: number;
}) {
  const cellSize = (gridWidth - CELL_GAP * (size - 1)) / size;
  const pitch = cellSize + CELL_GAP;
  const centre = (i: number) => i * pitch + cellSize / 2;

  const first = line.cells[0];
  const last = line.cells[line.cells.length - 1];
  const x1 = centre(first % size);
  const y1 = centre(Math.floor(first / size));
  const x2 = centre(last % size);
  const y2 = centre(Math.floor(last / size));

  const length = Math.hypot(x2 - x1, y2 - y1) + cellSize * STRIKE_OVERHANG;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  return (
    <span
      className="absolute rounded-full bg-primary-foreground/70"
      style={{
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - STRIKE_WIDTH / 2,
        width: length,
        height: STRIKE_WIDTH,
        transform: `rotate(${angle}rad)`,
      }}
    />
  );
});

export interface BoardGridProps {
  cells: Cell[];
  size: number;
  variant?: BoardVariant;
  /** Setup only: the single cell picked for a swap. */
  selectedIndex?: number | null;
  /** Completed rows/columns/diagonals to strike through. */
  completedLines?: LineDescriptor[];
  onCellPress?: (cell: Cell) => void;
  /** Play: your turn. Setup: not yet submitted. Drives the hint only. */
  canActivate?: boolean;
  /** Hint wording for actionable cells. Must be a stable string. */
  cellHint?: string;
  /** Spoken as the grid's own name, e.g. "Your board". */
  label: string;
  /**
   * Set when something outside the grid needs to move focus into it.
   *
   * An id rather than a forwarded ref: the caller is a shortcut hook that only
   * ever reads the live DOM, and an id keeps it entirely decoupled from this
   * component's render cycle and memoization.
   */
  id?: string;
  /** Answers a readout asked from the focused cell. See `boardActions.ts`. */
  onBoardAction?: (action: BoardActionName, cellIndex: number) => void;
  /** Jumps the player's microphone on and off, for the bare `M` key. */
  onToggleMic?: () => void;
}

/**
 * N×N board grid.
 *
 * Every cell is its own accessibility node inside a `role="grid"`, so screen
 * reader and keyboard users move between them with the arrow keys and activate
 * with Enter or Space.
 *
 * **Roving tabindex** is what makes that bearable: exactly one cell is tabbable
 * at a time, so an 8×8 board is one stop on the way through the page rather
 * than 64. Arrow keys move within the grid, Home/End jump to the ends of a row,
 * Ctrl+Home/End to the corners of the board.
 */
export function BoardGrid({
  cells,
  size,
  id,
  variant = 'play',
  selectedIndex,
  completedLines,
  onCellPress,
  canActivate,
  cellHint,
  label,
  onBoardAction,
  onToggleMic,
}: BoardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Subscribed here, not in the cell: one subscription for the board rather
  // than N², and the value reaches each cell as a primitive so `memo` holds.
  const notation = useNotation();
  const [gridWidth, setGridWidth] = useState(0);
  const [rovingIndex, setRovingIndex] = useState(0);
  const hintId = `board-hint-${variant}`;

  // A board that shrank (the host changed the size) must not leave the roving
  // target pointing past the end. Derived rather than corrected in an effect,
  // so there is never a render where the tabbable cell does not exist.
  const activeIndex = rovingIndex < cells.length ? rovingIndex : 0;

  /**
   * Keep the caller's handler and the current cells behind refs so the press
   * callback handed to every cell never changes identity.
   *
   * Without this, each render would give all N² cells a brand-new closure and
   * `memo` would never hit — the whole board would re-render on every
   * countdown tick. (The mobile board learned this the hard way.)
   */
  const pressRef = useRef(onCellPress);
  const actionRef = useRef(onBoardAction);
  const micRef = useRef(onToggleMic);
  const cellsRef = useRef(cells);
  useEffect(() => {
    pressRef.current = onCellPress;
    actionRef.current = onBoardAction;
    micRef.current = onToggleMic;
    cellsRef.current = cells;
  });

  const handleActivate = useCallback((index: number) => {
    const cell = cellsRef.current[index];
    if (cell) pressRef.current?.(cell);
  }, []);

  // Focusing a cell with the mouse or Tab makes it the roving target, so the
  // arrow keys continue from wherever the player actually is.
  const handleFocusCell = useCallback((index: number) => setRovingIndex(index), []);

  // Measure for the strike overlay. `ResizeObserver` covers window resizes,
  // font-size changes and the desktop two-column breakpoint alike.
  useLayoutEffect(() => {
    const node = gridRef.current;
    if (!node) return;

    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? 0;
      // Only re-render on a real change; observers fire on every re-measure.
      setGridWidth(previous => (Math.abs(next - previous) < 0.5 ? previous : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const moveFocus = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, cellsRef.current.length - 1));
    setRovingIndex(clamped);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-index="${clamped}"]`)
      ?.focus();
  }, []);

  /**
   * The single letters, handled here rather than through `useShortcut`.
   *
   * They are consumed inside the grid, which is the only place they are safe:
   * a bare `R` bound on `document` would fire while a screen-reader user was
   * reading the page in browse mode, where `R` is their own quick-nav key.
   * Inside a `role="grid"` both NVDA and JAWS switch to focus mode and hand
   * every key straight to the page.
   */
  const handleLetter = useCallback(
    (key: string): boolean => {
      const action = BOARD_ACTIONS.find(spec => spec.key === key);
      if (action) {
        actionRef.current?.(action.name, activeIndex);
        return true;
      }
      if (key === 'B') {
        // A fixed landmark to navigate from. The round trip in and out of the
        // board stays on Alt+B, which is reachable from outside it.
        moveFocus(0);
        return true;
      }
      if (key === 'M') {
        micRef.current?.();
        return true;
      }
      if (key === '?') {
        announcer.speak(describeBoardKeys(), TIER.summary);
        return true;
      }
      return false;
    },
    [activeIndex, moveFocus],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const row = Math.floor(activeIndex / size);
      const column = activeIndex % size;
      let next: number | null = null;

      switch (event.key) {
        case 'ArrowRight':
          if (column < size - 1) next = activeIndex + 1;
          break;
        case 'ArrowLeft':
          if (column > 0) next = activeIndex - 1;
          break;
        case 'ArrowDown':
          if (row < size - 1) next = activeIndex + size;
          break;
        case 'ArrowUp':
          if (row > 0) next = activeIndex - size;
          break;
        case 'Home':
          next = event.ctrlKey ? 0 : row * size;
          break;
        case 'End':
          next = event.ctrlKey ? size * size - 1 : row * size + (size - 1);
          break;
        default: {
          // Chords belong to the browser, the screen reader, and the global
          // bindings in `SHORTCUTS` — only the bare key is ours.
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          if (!handleLetter(event.key.toUpperCase())) return;
          event.preventDefault();
          return;
        }
      }

      if (next === null) {
        // Nowhere to go. The key is still swallowed, so the arrow does not
        // scroll the page out from under the player — but saying nothing at
        // all was indistinguishable from a dropped keypress, and the usual
        // response to that is to press harder and lose your place.
        const edge = edgeNameAt(activeIndex, size, event.key as ArrowKey);
        if (edge) {
          announcer.speak(edge, TIER.interrupt);
          // No `edge_bump` clip exists yet (see docs/audio-report.md); this is
          // the nearest cue in the registry rather than a new asset.
          audioManager.play('board_invalid');
        }
        event.preventDefault();
        return;
      }

      event.preventDefault();
      moveFocus(next);
    },
    [activeIndex, size, moveFocus, handleLetter],
  );

  // Membership is looked up per cell, so flatten the lines once rather than
  // scanning them N² times.
  const lineCells = useMemo(
    () => new Set(completedLines?.flatMap(line => line.cells) ?? []),
    [completedLines],
  );

  const rows = useMemo(() => {
    const out: Cell[][] = [];
    for (let i = 0; i < cells.length; i += size) out.push(cells.slice(i, i + size));
    return out;
  }, [cells, size]);

  const strikes = gridWidth > 0 ? (completedLines ?? []) : [];

  return (
    <div className="relative w-full">
      {/* Referenced by every actionable cell's `aria-describedby`. */}
      {cellHint ? (
        <span id={hintId} hidden>
          {cellHint}
        </span>
      ) : null}

      <div
        ref={gridRef}
        id={id}
        role="grid"
        aria-label={label}
        aria-rowcount={size}
        aria-colcount={size}
        onKeyDown={onKeyDown}
        // `container-type` is what makes the cells' `cqw` font sizing resolve
        // against the board rather than the viewport.
        className="grid w-full [container-type:inline-size]"
        style={{ gap: CELL_GAP }}>
        {rows.map((row, r) => (
          <div
            key={r}
            role="row"
            aria-rowindex={r + 1}
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              gap: CELL_GAP,
            }}>
            {row.map(cell => (
              <BoardCell
                key={cell.index}
                index={cell.index}
                value={cell.value}
                size={size}
                variant={variant}
                marked={cell.marked}
                selected={selectedIndex === cell.index}
                inCompletedLine={lineCells.has(cell.index)}
                actionable={
                  Boolean(canActivate) &&
                  cell.value !== null &&
                  (variant === 'setup' || !cell.marked)
                }
                hintId={hintId}
                tabbable={cell.index === activeIndex}
                notation={notation}
                onActivate={handleActivate}
                onFocusCell={handleFocusCell}
              />
            ))}
          </div>
        ))}
      </div>

      {strikes.length > 0 ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {strikes.map(line => (
            <LineStrike
              key={`${line.type}-${line.index}`}
              line={line}
              size={size}
              gridWidth={gridWidth}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
