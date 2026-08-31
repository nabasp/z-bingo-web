/**
 * Ported from `bingo/src/features/game/context/GameSocketProvider.tsx`.
 *
 * The socket contract, the event wiring and the snapshot-merge rule are
 * identical — only the import paths and the React Native `React.ReactNode`
 * differ. The server is authoritative for every field here; components read
 * this state and emit intents, nothing more.
 */

/*
 * The react-hooks rules are waived for this file, all for the same reason: it
 * is a bridge to an external system (the Socket.IO connection), which is
 * exactly the case their assumptions do not cover.
 *
 * - `react-hooks/refs` fires on the emit helpers, which read `socketRef.current`
 *   inside callbacks. They are only ever invoked from event handlers, never
 *   during render; the analysis cannot see that through the context object.
 * - `react-hooks/set-state-in-effect` fires on the connection lifecycle, where
 *   setting state as the socket opens, drops or is torn down is the whole job.
 * - `react-hooks/preserve-manual-memoization` reports that the compiler could
 *   not verify the hand-written `useMemo` over that same set of callbacks.
 */
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createGameSocket, type GameSocket } from '@/lib/socketClient';
import { useAuth } from '@/features/auth/context';
import { GameRequestError } from './gameError';
import {
  GameSocketContext,
  type GameSocketValue,
  type SocketStatus,
} from './gameSocketContext';
import type {
  GameError,
  RoomClosedPayload,
  RoomSnapshot,
  ServerToClientEvents,
  WinnerDeclaredPayload,
} from '../types/events';



/**
 * Owns the Socket.IO connection and the single authoritative room snapshot.
 *
 * The client never derives game outcomes — every field here comes from the
 * server. Components read this state and emit intents; nothing more.
 */
export function GameSocketProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const socketRef = useRef<GameSocket | null>(null);

  /**
   * Subscriptions registered through `on`, kept outside the socket.
   *
   * The socket is torn down and rebuilt whenever auth changes, so a listener
   * attached directly to one instance would silently stop firing. Holding the
   * registrations here lets them be re-attached to each new socket, and lets
   * every `on` hand back an unsubscribe that works either way.
   */
  const externalListeners = useRef(
    new Map<string, Set<(...args: unknown[]) => void>>(),
  );

  const [connection, setConnection] = useState<SocketStatus>('idle');
  const [synced, setSynced] = useState(false);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<GameError | null>(null);
  const [notice, setNotice] = useState<RoomClosedPayload | null>(null);
  const [winner, setWinner] = useState<WinnerDeclaredPayload | null>(null);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      // Signed out (or still restoring): tear any existing socket down.
      socketRef.current?.close();
      socketRef.current = null;
      setConnection('idle');
      setSynced(false);
      setRoom(null);
      setWinner(null);
      return;
    }

    const socket = createGameSocket();
    socketRef.current = socket;
    setConnection('connecting');

    socket.on('connect', () => {
      setConnection('connected');

      /*
       * Resume whatever room we were in.
       *
       * `sync` is now the whole story. The server resolves membership from the
       * authenticated account rather than from per-socket state, so a reload or
       * a reconnect — which always arrives on a brand new socket — finds the
       * room on its own. This used to need a `sessionStorage` copy of the room
       * code re-sent as a `join_room`; that workaround existed only because the
       * server could not answer the question, and mobile, which had no such
       * workaround, simply lost the game on every blip.
       *
       * `synced` flips either way: "you are in no room" is just as much an
       * answer as a snapshot, and callers must tell both apart from "not asked".
       */
      socket.emit('sync', res => {
        if (res.ok && res.data) setRoom(res.data);
        else if (!res.ok) setError(res.error);
        setSynced(true);
      });
    });

    socket.on('disconnect', () => setConnection('offline'));
    socket.on('connect_error', () => setConnection('offline'));

    const applySnapshot = (snapshot: RoomSnapshot) => {
      setRoom(previous => {
        // A public broadcast has no board; keep the one we already hold so a
        // room_updated never wipes the player's own board.
        const yourBoard = snapshot.yourBoard ?? previous?.yourBoard;
        return { ...snapshot, yourBoard };
      });
    };

    socket.on('room_updated', applySnapshot);
    socket.on('game_state_updated', applySnapshot);
    socket.on('game_started', snapshot => {
      setWinner(null);
      applySnapshot(snapshot);
    });
    socket.on('winner_declared', payload => setWinner(payload));
    socket.on('error', payload => setError(payload));

    // The room ended without us asking. Keep the reason — the route guard is
    // about to send us home, and the explanation has to arrive with us.
    socket.on('room_closed', payload => {
      setNotice(payload);
      setRoom(null);
      setWinner(null);
    });

    socket.on('session_superseded', () => {
      setNotice({
        code: '',
        reason: 'empty',
        message: 'You joined from another device, so this tab left the game.',
      });
      setRoom(null);
    });

    // Re-attach anything registered through `on` before the socket opens, so a
    // subscriber never misses the first event after a reconnect.
    for (const [event, handlers] of externalListeners.current) {
      for (const handler of handlers) socket.on(event as never, handler as never);
    }

    socket.connect();

    /*
     * Nudge the socket when the tab comes back.
     *
     * Browsers throttle timers in a backgrounded tab, so socket.io's reconnect
     * backoff can be stretched to the point where a player who switches away
     * mid-match returns to a still-disconnected socket and no obvious reason
     * why. Reconnecting on the way back in makes the recovery immediate; the
     * server's grace period is what keeps their seat during the gap.
     */
    const onVisible = () => {
      if (!document.hidden && !socket.connected) socket.connect();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [authStatus]);

  const on = useCallback(
    <E extends keyof ServerToClientEvents>(
      event: E,
      handler: ServerToClientEvents[E],
    ): (() => void) => {
      const key = event as string;
      const fn = handler as unknown as (...args: unknown[]) => void;

      const handlers = externalListeners.current.get(key) ?? new Set();
      handlers.add(fn);
      externalListeners.current.set(key, handlers);
      socketRef.current?.on(event as never, fn as never);

      return () => {
        externalListeners.current.get(key)?.delete(fn);
        socketRef.current?.off(event as never, fn as never);
      };
    },
    [],
  );

  /** Emit an ack event as a promise, rejecting with the server's error. */
  const request = useCallback(
    <T,>(run: (socket: GameSocket, resolve: (v: T) => void, reject: (e: Error) => void) => void) =>
      new Promise<T>((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket) {
          reject(new Error('Not connected. Please try again.'));
          return;
        }
        run(socket, resolve, reject);
      }),
    [],
  );

  const createRoom = useCallback(
    (size: number, maxPlayers: number, turnSeconds: number) =>
      request<RoomSnapshot>((socket, resolve, reject) => {
        socket.emit('create_room', { size, maxPlayers, turnSeconds }, res => {
          if (res.ok) {
            setWinner(null);
            setNotice(null);
            setRoom(res.data);
            resolve(res.data);
          } else {
            reject(new GameRequestError(res.error));
          }
        });
      }),
    [request],
  );

  const joinRoom = useCallback(
    (code: string) =>
      request<RoomSnapshot>((socket, resolve, reject) => {
        socket.emit('join_room', { code }, res => {
          if (res.ok) {
            setWinner(null);
            setNotice(null);
            setRoom(res.data);
            resolve(res.data);
          } else {
            reject(new GameRequestError(res.error));
          }
        });
      }),
    [request],
  );

  const setReady = useCallback((ready: boolean) => {
    socketRef.current?.emit('player_ready', { ready });
  }, []);

  const setSize = useCallback((size: number) => {
    socketRef.current?.emit('set_size', { size });
  }, []);

  const setTurnSeconds = useCallback((turnSeconds: number) => {
    socketRef.current?.emit('set_turn_seconds', { turnSeconds });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit('start_game');
  }, []);

  const submitBoard = useCallback((board: number[]) => {
    socketRef.current?.emit('submit_board', { board });
  }, []);

  const callNumber = useCallback((value: number) => {
    socketRef.current?.emit('call_number', { number: value });
  }, []);

  const rematch = useCallback((size?: number) => {
    setWinner(null);
    socketRef.current?.emit('rematch', { size });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave_room');
    setRoom(null);
    setWinner(null);
    // Leaving is deliberate, so there is nothing to explain on the way out.
    setNotice(null);
  }, []);

  const me = useMemo(
    () => room?.players.find(p => p.id === user?.id) ?? null,
    [room, user?.id],
  );

  const value = useMemo<GameSocketValue>(
    () => ({
      connection,
      synced,
      room,
      error,
      notice,
      winner,
      me,
      isHost: Boolean(room && user?.id && room.hostId === user.id),
      isMyTurn: Boolean(me && room && me.seat === room.currentTurnSeat),
      clearError: () => setError(null),
      clearNotice: () => setNotice(null),
      on,
      request,
      createRoom,
      joinRoom,
      setReady,
      setSize,
      setTurnSeconds,
      startGame,
      submitBoard,
      callNumber,
      rematch,
      leaveRoom,
    }),
    [
      connection,
      synced,
      room,
      error,
      notice,
      winner,
      me,
      user?.id,
      on,
      request,
      createRoom,
      joinRoom,
      setReady,
      setSize,
      setTurnSeconds,
      startGame,
      submitBoard,
      callNumber,
      rematch,
      leaveRoom,
    ],
  );

  return (
    <GameSocketContext.Provider value={value}>
      {children}
    </GameSocketContext.Provider>
  );
}
