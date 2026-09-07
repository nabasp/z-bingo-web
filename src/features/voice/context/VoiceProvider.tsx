/* eslint-disable react-hooks/exhaustive-deps --
 * The connect effect is keyed deliberately on the room code alone. It bridges
 * to an external system (a LiveKit `Room`) whose lifetime must follow the game
 * room and nothing else; including the callbacks it happens to call would tear
 * the call down and rebuild it on unrelated renders. Same rationale as the
 * disable in GameSocketProvider.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Room, RoomEvent as RoomEventEnum } from 'livekit-client';
import { useGameSocket } from '@/features/game/context';
import type { VoiceCredentials, VoiceStatus } from '@/features/game/types';
import { announcer } from '@/lib/a11y';
import { VoiceContext, type VoiceConnection, type VoiceValue } from './voiceContext';
import { VoiceParticipantsContext, type VoiceParticipantsValue } from './voiceParticipants';
import { classifyVoiceError } from '../voiceErrors';

/** Stable identity, so the "no call" participants value never changes. */
const EMPTY_MICS: ReadonlyMap<string, VoiceStatus> = new Map();

/**
 * Owns the LiveKit session for the current game room.
 *
 * The whole lifecycle is one effect keyed on the room code: entering a room
 * connects, leaving disconnects, and moving between rooms does both in order.
 * Nothing else starts or stops a call, which is what keeps the audio from
 * outliving the game — the requirement that motivated mounting this inside the
 * game routes rather than at the app root.
 *
 * Two guards make that safe against React's development double-mount and
 * against a player leaving mid-connect: a `cancelled` flag and an `epoch`
 * counter. Every `await` is followed by a check, because the dangerous window
 * is not the token request — it is the moment after `connect()` resolves, when
 * a real session exists that nobody is holding a reference to yet.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const { room, request } = useGameSocket();
  const code = room?.code ?? null;

  const [connection, setConnection] = useState<VoiceConnection>('off');
  const [message, setMessage] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [mics, setMics] = useState<ReadonlyMap<string, VoiceStatus>>(new Map());

  const roomRef = useRef<Room | null>(null);
  const epochRef = useRef(0);
  /** Bumped by `retry()` to re-run the effect without changing rooms. */
  const [attempt, setAttempt] = useState(0);

  const say = useCallback((text: string, assertive: boolean) => {
    // One dedupe key for every voice message: a flapping network should not
    // read a screen-reader user the same two sentences over and over.
    announcer.speak(text, { assertive, dedupeKey: 'voice-status' });
  }, []);

  const fail = useCallback(
    (error: unknown) => {
      const failure = classifyVoiceError(error);
      setConnection(failure.connection);
      setMessage(failure.message);
      setMicOn(false);
      say(failure.message, failure.assertive);
    },
    [say],
  );

  useEffect(() => {
    // Nothing to connect to. The exposed state is derived below rather than
    // written here: resetting four pieces of state from an effect body would
    // cascade a second render for no benefit, and "not in a room" is a fact
    // about `code`, not something to remember.
    if (!code) return;

    const epoch = ++epochRef.current;
    let cancelled = false;
    /** Has this run of the effect been superseded or torn down? */
    const stale = () => cancelled || epoch !== epochRef.current;

    void (async () => {
      setConnection('connecting');
      setMessage(null);

      try {
        const credentials = await request<VoiceCredentials>((socket, resolve, reject) => {
          socket.emit('voice_token', res =>
            res.ok ? resolve(res.data) : reject(Object.assign(new Error(res.error.message), res.error)),
          );
        });
        if (stale()) return;

        // Imported here rather than at module scope: livekit-client is a few
        // hundred kilobytes, and only the game routes ever need it.
        const { Room: LiveKitRoom, RoomEvent } = await import('livekit-client');
        if (stale()) return;

        const session = new LiveKitRoom({ adaptiveStream: false, dynacast: false });

        /**
         * Rebuild the participant map from the session.
         *
         * Recomputed wholesale on every event rather than patched per event:
         * the map is at most four entries, and a single source of truth cannot
         * drift out of step with LiveKit the way incremental updates can.
         */
        const syncMics = () => {
          if (stale()) return;
          const next = new Map<string, VoiceStatus>();
          next.set(
            session.localParticipant.identity,
            session.localParticipant.isMicrophoneEnabled ? 'mic-on' : 'mic-off',
          );
          for (const participant of session.remoteParticipants.values()) {
            next.set(participant.identity, participant.isMicrophoneEnabled ? 'mic-on' : 'mic-off');
          }
          setMics(next);
          setMicOn(session.localParticipant.isMicrophoneEnabled);
        };

        wireSession(session, RoomEvent, {
          syncMics,
          onReconnecting: () => {
            if (stale()) return;
            setConnection('reconnecting');
            const text = 'Voice chat is reconnecting.';
            setMessage(text);
            say(text, false);
          },
          onReconnected: () => {
            if (stale()) return;
            setConnection('live');
            setMessage(null);
            say('Voice chat is back.', false);
            syncMics();
          },
          onDisconnected: () => {
            if (stale()) return;
            // A disconnect we did not ask for. The room itself going away is
            // handled by `code` changing, and that path already tore this down,
            // so reaching here means the session dropped underneath us.
            setConnection('off');
            setMics(new Map());
            setMicOn(false);
          },
          onMediaError: (error: unknown) => {
            if (stale()) return;
            fail(error);
          },
        });

        await session.connect(credentials.url, credentials.token);
        // The window that matters: a live session now exists, and if this run
        // was superseded while connecting nobody else will ever close it.
        if (stale()) {
          void session.disconnect();
          return;
        }
        roomRef.current = session;

        await session.localParticipant.setMicrophoneEnabled(true);
        if (stale()) {
          void session.disconnect();
          return;
        }

        setConnection('live');
        setMessage(null);
        syncMics();

        // Autoplay policies can leave audio blocked until a gesture. Say so
        // rather than letting the player wonder why the room is silent.
        if (!session.canPlaybackAudio) {
          const text = 'Choose Voice to hear the other players.';
          setMessage(text);
          say(text, true);
        }
      } catch (error) {
        if (!stale()) fail(error);
      }
    })();

    return () => {
      cancelled = true;
      // Invalidate any in-flight connect, so a late arrival closes itself.
      epochRef.current++;
      const session = roomRef.current;
      roomRef.current = null;
      void session?.disconnect();
    };
  }, [code, attempt]);

  /**
   * Stop publishing while the tab is hidden.
   *
   * Audio starts live in this game, so without this an alt-tab leaves a hot
   * microphone in someone else's room. Restores on return only if the player
   * had not muted themselves deliberately.
   */
  useEffect(() => {
    if (connection !== 'live') return;

    let mutedByHiding = false;
    const onVisibility = () => {
      const session = roomRef.current;
      if (!session) return;
      if (document.hidden) {
        if (session.localParticipant.isMicrophoneEnabled) {
          mutedByHiding = true;
          void session.localParticipant.setMicrophoneEnabled(false);
        }
      } else if (mutedByHiding) {
        mutedByHiding = false;
        void session.localParticipant.setMicrophoneEnabled(true);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [connection]);

  const toggleMic = useCallback(() => {
    const session = roomRef.current;
    if (!session) return;
    const next = !session.localParticipant.isMicrophoneEnabled;
    void session.localParticipant.setMicrophoneEnabled(next).catch(fail);
    // Optimistic: the event handler confirms it, but the button should not
    // feel laggy while the browser thinks about the microphone.
    setMicOn(next);
  }, [fail]);

  const retry = useCallback(() => {
    const session = roomRef.current;
    // Audio blocked by autoplay policy needs a gesture, not a reconnection.
    if (session && !session.canPlaybackAudio) {
      void session.startAudio().then(() => setMessage(null));
      return;
    }
    if (session) return;
    setAttempt(n => n + 1);
  }, []);

  // Outside a room there is no call, whatever the last one left behind. The
  // effect sets 'connecting' the instant a new room arrives, so masking the
  // stale values here cannot flash them.
  const value = useMemo<VoiceValue>(
    () =>
      code
        ? { connection, message, micOn, toggleMic, retry }
        : { connection: 'off', message: null, micOn: false, toggleMic, retry },
    [code, connection, message, micOn, toggleMic, retry],
  );

  // Its own object, so a mute somewhere in the room does not hand every
  // consumer of VoiceContext a new value.
  const participants = useMemo<VoiceParticipantsValue>(
    () => ({ mics: code ? mics : EMPTY_MICS }),
    [code, mics],
  );

  return (
    <VoiceContext.Provider value={value}>
      <VoiceParticipantsContext.Provider value={participants}>
        {children}
      </VoiceParticipantsContext.Provider>
    </VoiceContext.Provider>
  );
}

interface SessionHandlers {
  syncMics: () => void;
  onReconnecting: () => void;
  onReconnected: () => void;
  onDisconnected: () => void;
  onMediaError: (error: unknown) => void;
}

/**
 * Subscribe to the events that can change what the UI shows.
 *
 * Everything here is push: LiveKit tells us when something changes, and there
 * is no interval anywhere in this feature. The listeners are not removed
 * individually because `disconnect()` disposes the session that owns them.
 */
function wireSession(
  session: Room,
  RoomEvent: typeof RoomEventEnum,
  handlers: SessionHandlers,
): void {
  const { syncMics } = handlers;
  session
    .on(RoomEvent.ParticipantConnected, syncMics)
    .on(RoomEvent.ParticipantDisconnected, syncMics)
    .on(RoomEvent.TrackMuted, syncMics)
    .on(RoomEvent.TrackUnmuted, syncMics)
    .on(RoomEvent.TrackSubscribed, syncMics)
    .on(RoomEvent.TrackUnsubscribed, syncMics)
    .on(RoomEvent.LocalTrackPublished, syncMics)
    .on(RoomEvent.LocalTrackUnpublished, syncMics)
    .on(RoomEvent.Reconnecting, handlers.onReconnecting)
    .on(RoomEvent.Reconnected, handlers.onReconnected)
    .on(RoomEvent.Disconnected, handlers.onDisconnected)
    .on(RoomEvent.MediaDevicesError, handlers.onMediaError);
}
