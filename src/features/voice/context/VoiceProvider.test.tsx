import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The provider's contract with LiveKit.
 *
 * What matters here is not that audio works — that needs a real SFU — but that
 * exactly one session exists per game room, that it always gets closed, and
 * that failures turn into words rather than a broken screen. So LiveKit is
 * faked the same way `GameSocketProvider.test.tsx` fakes the socket: a stand-in
 * `Room` whose events we can play back by hand.
 */

const listeners = new Map<string, (payload?: unknown) => void>();

const localParticipant = {
  identity: 'ann',
  isMicrophoneEnabled: false,
  setMicrophoneEnabled: vi.fn(async (on: boolean) => {
    localParticipant.isMicrophoneEnabled = on;
  }),
};

const fakeRoom = {
  localParticipant,
  remoteParticipants: new Map<string, { identity: string; isMicrophoneEnabled: boolean }>(),
  canPlaybackAudio: true,
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  startAudio: vi.fn(async () => {}),
  on(event: string, handler: (payload?: unknown) => void) {
    listeners.set(event, handler);
    return fakeRoom;
  },
};

/** How many `Room` instances the provider has constructed. */
let constructed = 0;

vi.mock('livekit-client', () => ({
  Room: class {
    constructor() {
      constructed++;
      return fakeRoom as unknown as object;
    }
  },
  // The provider only uses these as map keys, so echoing the property name is
  // all the fidelity required — tests fire events by their enum key
  // ('TrackUnmuted'), not livekit's wire value ('trackUnmuted').
  RoomEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));

/** The game room the socket reports, swapped between renders. */
let currentRoom: { code: string } | null = { code: 'brave-otter' };
let tokenRequest = vi.fn(async () => ({
  url: 'wss://example.test/livekit',
  token: 'jwt',
  room: 'brave-otter-1a2b3c4d',
  expiresAt: Date.now() + 3_600_000,
}));

vi.mock('@/features/game/context', () => ({
  useGameSocket: () => ({ room: currentRoom, request: () => tokenRequest() }),
}));

const speak = vi.fn();
vi.mock('@/lib/a11y', () => ({
  announcer: { speak: (...args: unknown[]) => speak(...args) },
  sentence: (...parts: unknown[]) => parts.filter(Boolean).join('. '),
}));

const { VoiceProvider } = await import('./VoiceProvider');
const { useVoice } = await import('./useVoice');
const { useMicState } = await import('../hooks/useMicState');

function fire(event: string, payload?: unknown): void {
  act(() => listeners.get(event)?.(payload));
}

/** Renders the context so assertions can read it out of the DOM. */
function Probe({ watch = 'ann' }: { watch?: string }) {
  const { connection, message, micOn } = useVoice();
  const mic = useMicState(watch);
  return (
    <>
      <span data-testid="connection">{connection}</span>
      <span data-testid="message">{message ?? ''}</span>
      <span data-testid="micOn">{String(micOn)}</span>
      <span data-testid="mic">{mic}</span>
    </>
  );
}

async function mount(strict = false): Promise<ReturnType<typeof render>> {
  const tree = (
    <VoiceProvider>
      <Probe />
    </VoiceProvider>
  );
  const result = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  // Let the connect chain (token → import → connect → publish) settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

beforeEach(() => {
  listeners.clear();
  constructed = 0;
  currentRoom = { code: 'brave-otter' };
  localParticipant.isMicrophoneEnabled = false;
  fakeRoom.remoteParticipants = new Map();
  fakeRoom.canPlaybackAudio = true;
  fakeRoom.connect = vi.fn(async () => {});
  fakeRoom.disconnect = vi.fn(async () => {});
  fakeRoom.startAudio = vi.fn(async () => {});
  tokenRequest = vi.fn(async () => ({
    url: 'wss://example.test/livekit',
    token: 'jwt',
    room: 'brave-otter-1a2b3c4d',
    expiresAt: Date.now() + 3_600_000,
  }));
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('VoiceProvider: connection lifecycle', () => {
  it('joins the room and publishes the microphone', async () => {
    await mount();

    expect(fakeRoom.connect).toHaveBeenCalledWith('wss://example.test/livekit', 'jwt');
    expect(localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('connection').textContent).toBe('live');
  });

  it('opens exactly one session under StrictMode', async () => {
    // React mounts effects twice in development. Without the epoch guard this
    // is where a second, unreferenced LiveKit session would leak.
    await mount(true);

    expect(constructed).toBe(1);
    expect(fakeRoom.connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the player leaves the room', async () => {
    const { rerender } = await mount();
    currentRoom = null;

    await act(async () => {
      rerender(
        <VoiceProvider>
          <Probe />
        </VoiceProvider>,
      );
    });

    expect(fakeRoom.disconnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('connection').textContent).toBe('off');
  });

  it('disconnects on unmount', async () => {
    const { unmount } = await mount();
    act(() => unmount());

    expect(fakeRoom.disconnect).toHaveBeenCalledTimes(1);
  });

  it('closes a session that finishes connecting after unmount', async () => {
    // The dangerous window: `connect()` resolves into a torn-down provider, so
    // a real session exists that nothing else holds a reference to.
    let release!: () => void;
    fakeRoom.connect = vi.fn(
      () => new Promise<void>(resolve => { release = resolve; }),
    );

    const { unmount } = await mount();
    act(() => unmount());
    await act(async () => {
      release();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fakeRoom.disconnect).toHaveBeenCalled();
  });

  it('does not request a token when there is no room', async () => {
    currentRoom = null;
    await mount();

    expect(tokenRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('connection').textContent).toBe('off');
  });
});

describe('VoiceProvider: participants', () => {
  it('tracks each participant by their player id', async () => {
    fakeRoom.remoteParticipants = new Map([
      ['bob', { identity: 'bob', isMicrophoneEnabled: true }],
    ]);
    render(
      <VoiceProvider>
        <Probe watch="bob" />
      </VoiceProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    fire('TrackUnmuted');
    expect(screen.getByTestId('mic').textContent).toBe('mic-on');
  });

  it('reports a player who is not in the call as muted', async () => {
    render(
      <VoiceProvider>
        <Probe watch="stranger" />
      </VoiceProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('mic').textContent).toBe('mic-off');
  });
});

describe('VoiceProvider: failures speak', () => {
  it('explains a refused microphone and offers a retry', async () => {
    fakeRoom.connect = vi.fn(async () => {
      throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    });
    await mount();

    expect(screen.getByTestId('connection').textContent).toBe('denied');
    expect(screen.getByTestId('message').textContent).toMatch(/try again/i);
    // Assertive: the player has to decide something.
    expect(speak).toHaveBeenCalledWith(expect.stringMatching(/refused/i), {
      assertive: true,
      dedupeKey: 'voice-status',
    });
  });

  it('says voice is off without implying the game is broken', async () => {
    tokenRequest = vi.fn(async () => {
      throw Object.assign(new Error('nope'), { code: 'voice_unavailable' });
    });
    await mount();

    expect(screen.getByTestId('connection').textContent).toBe('unavailable');
    expect(screen.getByTestId('message').textContent).toMatch(/game works as usual/i);
  });

  it('reports a missing microphone as something you can play through', async () => {
    fakeRoom.connect = vi.fn(async () => {
      throw Object.assign(new Error('none'), { name: 'NotFoundError' });
    });
    await mount();

    expect(screen.getByTestId('connection').textContent).toBe('unavailable');
    expect(screen.getByTestId('message').textContent).toMatch(/still hear/i);
  });

  it('narrates a reconnection and its recovery', async () => {
    await mount();

    fire('Reconnecting');
    expect(screen.getByTestId('connection').textContent).toBe('reconnecting');

    fire('Reconnected');
    expect(screen.getByTestId('connection').textContent).toBe('live');
    expect(speak).toHaveBeenCalledWith('Voice chat is back.', {
      assertive: false,
      dedupeKey: 'voice-status',
    });
  });

  it('deduplicates its announcements', async () => {
    // A flapping network must not read the same sentence repeatedly to a
    // screen-reader user; every voice message shares one dedupe key.
    await mount();
    fire('Reconnecting');

    for (const call of speak.mock.calls) {
      expect(call[1]).toMatchObject({ dedupeKey: 'voice-status' });
    }
  });
});
