import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/features/auth';
import {
  GameSocketContext,
  type GameSocketValue,
} from '@/features/game/context';
import { GameModeContext } from '@/features/game/mode';
import type { BoardSize, RematchState } from '@/features/game/types';
import { BotFeedbackBridge } from '../a11y/BotFeedbackBridge';
import { chooseBotCall } from '../engine/botPlayer';
import { botDelayMs } from '../engine/botTiming';
import {
  BOT_ID,
  BOT_SEAT,
  HUMAN_SEAT,
  callNumber as applyCall,
  restartBotGame,
  startBotGame,
  submitHumanBoard,
  toSnapshot,
  toWinnerPayload,
  type BotGameState,
} from '../engine/botGame';

/**
 * A whole game of bingo, on the device, wearing the shape of a room.
 *
 * **Why it supplies `GameSocketContext`.** Every gameplay screen reads that one
 * context and nothing else — `useGame` and `useBoardSetup` are pure projections
 * of the snapshot it carries. Supplying it locally is what lets the board, the
 * setup screen and the result screen be reused exactly as they are, instead of
 * a second copy of the game growing alongside the first. Nothing here touches
 * the socket: the fields that would have, below, are inert.
 *
 * **No room is created.** No code, no lobby, no ready handshake, no server. The
 * snapshot is built from local state on every change.
 */
export interface BotGameProviderProps {
  size: BoardSize;
  firstTurn?: 'human' | 'bot';
  /** Called when the player leaves, so the host screen can navigate away. */
  onLeave?: () => void;
  children: React.ReactNode;
}

export function BotGameProvider({
  size,
  firstTurn,
  onLeave,
  children,
}: BotGameProviderProps) {
  const { user } = useAuth();
  const human = useMemo(
    () => ({
      // The player's real account id: `useGame` decides whether a call was
      // yours by comparing against it, and the result standings are keyed by it.
      id: user?.id ?? 'you',
      name: user?.fullName || 'You',
    }),
    [user?.id, user?.fullName],
  );

  const [state, setState] = useState<BotGameState>(() =>
    startBotGame({ size, human, firstTurn }),
  );

  /**
   * The player has walked away from this game.
   *
   * Leaving navigates home, but a native stack keeps the screen it left
   * mounted — so without this the bot would go on taking its turns in a game
   * nobody is watching, announcing calls over whatever the player moved on to.
   */
  const [abandoned, setAbandoned] = useState(false);

  /**
   * The bot's pending move — the only timer this mode owns.
   *
   * A single ref, so "clean up everything the bot has scheduled" is one call
   * that cannot miss a case. Cleared before every arm, on every status change,
   * and on unmount.
   */
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearBotTimer = useCallback(() => {
    if (botTimer.current === null) return;
    clearTimeout(botTimer.current);
    botTimer.current = null;
  }, []);

  const callNumber = useCallback((value: number) => {
    setState(current => applyCall(current, current.human.id, value).state);
  }, []);

  const submitBoard = useCallback((board: number[]) => {
    setState(current => submitHumanBoard(current, board));
  }, []);

  const leaveRoom = useCallback(() => {
    clearBotTimer();
    setAbandoned(true);
    onLeave?.();
  }, [clearBotTimer, onLeave]);

  const rematch = useCallback(async (): Promise<RematchState> => {
    clearBotTimer();
    setAbandoned(false);
    setState(restartBotGame);
    // Nobody to wait on, so the result screen's "waiting for…" line never shows.
    return { started: true, waitingFor: [], expiresAt: 0 };
  }, [clearBotTimer]);

  /**
   * The bot's turn.
   *
   * It is handed its own board and the public call list — and nothing else.
   * See `botPlayer.ts`: the human's board is not a parameter of the decision,
   * which is what makes the fairness structural rather than a promise.
   */
  useEffect(() => {
    clearBotTimer();
    if (abandoned) return;
    if (state.status !== 'playing' || state.currentTurnSeat !== BOT_SEAT) return;

    const value = chooseBotCall(state.botBoard, state.calledNumbers);
    if (value === null) return;

    // A pause, so the opponent reads as somebody thinking rather than a
    // machine, and so the player's own announcement is not stepped on.
    botTimer.current = setTimeout(() => {
      botTimer.current = null;
      setState(current => applyCall(current, BOT_ID, value).state);
    }, botDelayMs());

    return clearBotTimer;
  }, [
    abandoned,
    state.status,
    state.currentTurnSeat,
    state.botBoard,
    state.calledNumbers,
    clearBotTimer,
  ]);

  /** Nothing the bot scheduled may outlive the screen. */
  useEffect(() => clearBotTimer, [clearBotTimer]);

  const room = useMemo(() => toSnapshot(state), [state]);
  const winner = useMemo(() => toWinnerPayload(state), [state]);

  const value = useMemo<GameSocketValue>(
    () => ({
      room,
      me: room.players[HUMAN_SEAT],
      isMyTurn: state.currentTurnSeat === HUMAN_SEAT,
      winner,
      // Local and instant, so there is nothing to be connecting to or to fail.
      connection: 'connected',
      synced: true,
      error: null,
      notice: null,
      rematchOffer: null,
      turnChangeReason: null,
      isHost: true,
      clearError: noop,
      clearNotice: noop,
      callNumber,
      submitBoard,
      leaveRoom,
      rematch,
      declineRematch: leaveRoom,

      // ── Inert ────────────────────────────────────────────────────────────
      // Present to satisfy the contract the screens are typed against. None of
      // them is reachable from a bot game, and every one of them would mean
      // talking to a server this mode deliberately never talks to.
      on: () => noop,
      request: () => Promise.reject(new Error('Not available in a bot game.')),
      createRoom: () => Promise.reject(new Error('Not available in a bot game.')),
      joinRoom: () => Promise.reject(new Error('Not available in a bot game.')),
      setReady: noop,
      setSize: noop,
      setTurnSeconds: noop,
      startGame: noop,
    }),
    [room, winner, state.currentTurnSeat, callNumber, submitBoard, leaveRoom, rematch],
  );

  return (
    <GameModeContext.Provider value="bot">
      <GameSocketContext.Provider value={value}>
        {/*
          The feedback bridge in `App.tsx` is a sibling of the navigator, so it
          can never see this provider. Mounting one here is what gives a bot
          game its sounds and its spoken commentary.
        */}
        <BotFeedbackBridge room={room} myId={human.id} />
        {children}
      </GameSocketContext.Provider>
    </GameModeContext.Provider>
  );
}

function noop(): void {}
