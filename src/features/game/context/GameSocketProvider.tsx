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
import {
  GameSocketContext,
  type GameSocketValue,
  type SocketStatus,
} from './gameSocketContext';
import { forgetRoom, recallRoom, rememberRoom } from './roomMemory';
import type { GameError, RoomSnapshot, WinnerDeclaredPayload } from '../types/events';



/**
 * Owns the Socket.IO connection and the single authoritative room snapshot.
 *
 * The client never derives game outcomes — every field here comes from the
 * server. Components read this state and emit intents; nothing more.
 */
export function GameSocketProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const socketRef = useRef<GameSocket | null>(null);

  const [connection, setConnection] = useState<SocketStatus>('idle');
  const [synced, setSynced] = useState(false);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<GameError | null>(null);
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

      // Resume whatever room we were in. `synced` flips either way — "you are
      // in no room" is just as much an answer as a snapshot, and callers must
      // be able to tell both apart from "not asked yet".
      const remembered = recallRoom();
      if (remembered) {
        // A fresh socket carries no server-side room, so `sync` alone would
        // answer null even mid-match; `join_room` is the server's rejoin path
        // and restores seat, board and turn. See `roomMemory.ts`.
        socket.emit('join_room', { code: remembered }, res => {
          if (res.ok) {
            setRoom(res.data);
          } else {
            // The room was swept, ended, or we were removed. A rejoining player
            // short-circuits every other check on the server, so a failure here
            // genuinely means "you are not in that room" — drop the stale
            // snapshot rather than leave the player staring at a dead board,
            // and say why, since the route guard is about to send them home.
            forgetRoom();
            setRoom(null);
            setError(res.error);
          }
          setSynced(true);
        });
        return;
      }

      socket.emit('sync', res => {
        if (res.ok && res.data) setRoom(res.data);
        setSynced(true);
      });
    });

    socket.on('disconnect', () => setConnection('offline'));
    socket.on('connect_error', () => setConnection('offline'));

    const applySnapshot = (snapshot: RoomSnapshot) => {
      rememberRoom(snapshot.code);
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
    socket.on('session_superseded', () => {
      setError({
        code: 'session_superseded',
        message: 'You joined from another device.',
      });
      // The other session owns this room now; rejoining on reload would take
      // the connection straight back off them.
      forgetRoom();
      setRoom(null);
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [authStatus]);

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
            rememberRoom(res.data.code);
            setRoom(res.data);
            resolve(res.data);
          } else {
            reject(new Error(res.error.message));
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
            rememberRoom(res.data.code);
            setRoom(res.data);
            resolve(res.data);
          } else {
            reject(new Error(res.error.message));
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
    forgetRoom();
    setRoom(null);
    setWinner(null);
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
      winner,
      me,
      isHost: Boolean(room && user?.id && room.hostId === user.id),
      isMyTurn: Boolean(me && room && me.seat === room.currentTurnSeat),
      clearError: () => setError(null),
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
      winner,
      me,
      user?.id,
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
