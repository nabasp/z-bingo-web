import { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotGameProvider } from './BotGameProvider';
import { useGameSocket } from '@/features/game/context';
import { useGameMode } from '@/features/game/mode';
import type { GameSocketValue } from '@/features/game/context';
import { BOT_ID, BOT_SEAT, HUMAN_SEAT } from '../engine/botGame';

/**
 * Ported from `bingo-react-native/src/features/bot/context/BotGameProvider.test.tsx`.
 * Same contract; only the renderer and the mocking syntax differ.
 */
vi.mock('@/features/auth/context', () => ({
  useAuth: () => ({ user: { id: 'user-1', fullName: 'Siv Nabas' } }),
}));

/** The feedback bridge reaches the audio player and the announcer. */
vi.mock('../a11y/BotFeedbackBridge', () => ({
  BotFeedbackBridge: () => null,
}));

let game: GameSocketValue;
let mode: string;

/**
 * Publishes the context out to the test.
 *
 * Captured in an effect rather than during render: writing to an outer
 * variable while rendering is a side effect, and `act` flushes effects before
 * handing control back, so the values are in place by the time anything reads
 * them.
 */
function Probe(): null {
  const value = useGameSocket();
  const currentMode = useGameMode();
  useEffect(() => {
    game = value;
    mode = currentMode;
  });
  return null;
}

function renderProvider(
  props: Partial<React.ComponentProps<typeof BotGameProvider>> = {},
) {
  return render(
    <BotGameProvider size={3} {...props}>
      <Probe />
    </BotGameProvider>,
  );
}

/** Lay a board out and lock it in, as the setup page does. */
const BOARD = [1, 2, 3, 4, 5, 6, 7, 8, 9];
function startPlaying() {
  const view = renderProvider();
  act(() => game.submitBoard(BOARD));
  return view;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('a bot game is not a room', () => {
  it('is playable straight away, with no code and nothing to join', () => {
    renderProvider();
    expect(game.room?.status).toBe('setup');
    expect(game.connection).toBe('connected');
    expect(game.synced).toBe(true);
  });

  it('refuses the room-creating calls outright rather than reaching a server', async () => {
    renderProvider();
    await expect(game.createRoom(3, 2, 60)).rejects.toThrow();
    await expect(game.joinRoom('brave-otter')).rejects.toThrow();
    await expect(game.request(() => {})).rejects.toThrow();
  });

  it('tells the screens below which mode they are in', () => {
    renderProvider();
    expect(mode).toBe('bot');
  });

  it('seats the player under their own account id', () => {
    // `useGame` decides whether a call was yours by comparing against this.
    renderProvider();
    expect(game.room?.players[HUMAN_SEAT].id).toBe('user-1');
    expect(game.me?.id).toBe('user-1');
  });
});

describe('the bot takes its turn', () => {
  it('waits before playing, rather than answering instantly', () => {
    startPlaying();
    act(() => game.callNumber(1));
    expect(game.room?.currentTurnSeat).toBe(BOT_SEAT);

    // Nothing yet — the pause is what makes it read as somebody thinking.
    expect(game.room?.calledNumbers).toEqual([1]);

    act(() => vi.advanceTimersByTime(3000));
    expect(game.room?.calledNumbers).toHaveLength(2);
    expect(game.room?.currentTurnSeat).toBe(HUMAN_SEAT);
  });

  it('calls a number from its own board that nobody has called', () => {
    startPlaying();
    act(() => game.callNumber(1));
    act(() => vi.advanceTimersByTime(3000));

    const called = game.room!.calledNumbers;
    const botCall = called[1];
    expect(BOARD).toContain(botCall);
    expect(botCall).not.toBe(1);
    expect(game.room!.callHistory[1].playerId).toBe(BOT_ID);
  });

  it('opens the game itself when it goes first', () => {
    renderProvider({ firstTurn: 'bot' });
    act(() => game.submitBoard(BOARD));
    act(() => vi.advanceTimersByTime(3000));

    expect(game.room?.callHistory[0].playerId).toBe(BOT_ID);
  });

  it('does not play while the board is still being laid out', () => {
    renderProvider({ firstTurn: 'bot' });
    act(() => vi.advanceTimersByTime(5000));
    expect(game.room?.calledNumbers).toEqual([]);
  });
});

describe('cleanup', () => {
  it('stops the bot the moment the player leaves', () => {
    // A native stack keeps the screen mounted after navigating home, so a bot
    // left running would call into a game nobody is watching.
    startPlaying();
    act(() => game.callNumber(1));
    act(() => game.leaveRoom());
    act(() => vi.advanceTimersByTime(10000));

    expect(game.room?.calledNumbers).toEqual([1]);
  });

  it('leaves no timer behind when it unmounts', () => {
    const view = startPlaying();
    act(() => game.callNumber(1));
    act(() => view.unmount());

    expect(vi.getTimerCount()).toBe(0);
  });

  it('deals fresh boards and forgets the old game on a rematch', () => {
    startPlaying();
    act(() => game.callNumber(1));
    act(() => vi.advanceTimersByTime(3000));

    act(() => {
      void game.rematch();
    });

    expect(game.room?.status).toBe('setup');
    expect(game.room?.calledNumbers).toEqual([]);
    expect(game.room?.callHistory).toEqual([]);
    expect(game.winner).toBeNull();
  });

  it('starts the bot again after a rematch it had been stopped by leaving', () => {
    startPlaying();
    act(() => game.leaveRoom());
    act(() => {
      void game.rematch();
    });
    act(() => game.submitBoard(BOARD));
    act(() => game.callNumber(1));
    act(() => vi.advanceTimersByTime(3000));

    expect(game.room?.calledNumbers).toHaveLength(2);
  });
});

describe('a full game', () => {
  /**
   * Play until somebody wins, taking whatever turn is offered.
   *
   * The human calls its lowest uncalled number and the bot chooses its own;
   * neither is steered, and nothing is fed a winning number on purpose.
   */
  function playOut(limit = 40): void {
    for (let turn = 0; turn < limit; turn++) {
      if (game.room?.status === 'finished') return;
      if (game.isMyTurn) {
        const called = new Set(game.room!.calledNumbers);
        const next = BOARD.find(value => !called.has(value));
        if (next === undefined) return;
        act(() => game.callNumber(next));
      } else {
        act(() => vi.advanceTimersByTime(3000));
      }
    }
  }

  it('ends with a winner, by the ordinary rules', () => {
    startPlaying();
    playOut();

    expect(game.room?.status).toBe('finished');
    expect(game.winner).not.toBeNull();
  });

  /**
   * Both sides win sometimes, and neither is helped.
   *
   * Who wins is genuinely undecided: both boards hold all of 1..n², so every
   * call marks a cell on both, and which arrangement completes its third line
   * first comes down to the deal. A run of games only ever won by one side
   * would mean something was putting a thumb on the scale.
   */
  it('is won by both sides across a run of games', () => {
    const winners = new Set<string>();

    for (let round = 0; round < 40 && winners.size < 2; round++) {
      cleanup();
      renderProvider({ firstTurn: round % 2 === 0 ? 'human' : 'bot' });
      act(() => game.submitBoard(BOARD));
      playOut();
      if (game.winner) winners.add(game.winner.winnerId);
    }

    expect([...winners].sort()).toEqual([BOT_ID, 'user-1'].sort());
  });

  it('finishes just the same when the bot opens', () => {
    // Opening first does not decide it: both boards hold all of 1..n², so the
    // winner is whichever arrangement completes its third line first.
    renderProvider({ firstTurn: 'bot' });
    act(() => game.submitBoard(BOARD));
    playOut();

    expect(game.room?.status).toBe('finished');
    expect(game.winner).not.toBeNull();
  });

  it('marks the winning line on the player’s own board too', () => {
    // A call marks the cell on every board at once, so the standings carry
    // completed lines for whoever earned them, winner or not.
    startPlaying();
    playOut();
    const mine = game.winner!.results.find(r => r.playerId === 'user-1')!;
    expect(mine.letters).toBeGreaterThan(0);
  });
});

