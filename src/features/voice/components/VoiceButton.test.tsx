import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceContext, type VoiceConnection, type VoiceValue } from '../context/voiceContext';
import { VoiceButton } from './VoiceButton';

/**
 * The button's accessibility contract.
 *
 * Two rules are load-bearing here and easy to regress: it is never `disabled`
 * (a disabled control is unreachable by keyboard and explains nothing), and it
 * always states its status in words rather than relying on colour.
 */

const speak = vi.fn();
vi.mock('@/lib/a11y', () => ({
  announcer: { speak: (...args: unknown[]) => speak(...args) },
  sentence: (...parts: unknown[]) => parts.filter(Boolean).join('. '),
}));

function renderWith(overrides: Partial<VoiceValue> = {}) {
  const value: VoiceValue = {
    connection: 'live',
    message: null,
    micOn: true,
    toggleMic: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
  render(
    <VoiceContext.Provider value={value}>
      <VoiceButton />
    </VoiceContext.Provider>,
  );
  return value;
}

const EVERY_STATE: VoiceConnection[] = [
  'off',
  'connecting',
  'live',
  'reconnecting',
  'denied',
  'unavailable',
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('VoiceButton', () => {
  it('is never disabled, in any state', () => {
    // A player must always be able to reach this control and find out what is
    // going on — the same rule the board follows for cells it cannot accept.
    for (const connection of EVERY_STATE) {
      renderWith({ connection });
      expect(screen.getByRole('button')).not.toBeDisabled();
      cleanup();
    }
  });

  it('states its status in words, differently for every state', () => {
    const labels = new Set<string>();
    for (const connection of EVERY_STATE) {
      renderWith({ connection, micOn: false });
      const text = screen.getByRole('button').textContent ?? '';
      expect(text.trim()).not.toBe('');
      labels.add(text);
      cleanup();
    }
    // Nothing is distinguished by colour alone: each state reads differently.
    expect(labels.size).toBe(EVERY_STATE.length);
  });

  it('reports the microphone through aria-pressed while live', () => {
    renderWith({ connection: 'live', micOn: true });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');

    cleanup();
    renderWith({ connection: 'live', micOn: false });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not claim a pressed state when there is no microphone to press', () => {
    renderWith({ connection: 'unavailable' });
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });

  it('toggles the microphone when live', () => {
    const value = renderWith({ connection: 'live', micOn: true });
    screen.getByRole('button').click();

    expect(value.toggleMic).toHaveBeenCalledTimes(1);
  });

  it('retries from a failed state instead of doing nothing', () => {
    const value = renderWith({ connection: 'denied' });
    screen.getByRole('button').click();

    expect(value.retry).toHaveBeenCalledTimes(1);
  });

  it('says why the press did nothing while connecting', () => {
    // The alternative — a silently inert button — is what the disabled version
    // used to be, and is exactly what this design avoids.
    const value = renderWith({ connection: 'connecting' });
    screen.getByRole('button').click();

    expect(value.toggleMic).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith(
      expect.stringMatching(/still connecting/i),
      expect.objectContaining({ assertive: true }),
    );
  });

  it('carries an accessible name beyond the visible label', () => {
    renderWith({ connection: 'live', micOn: false });
    expect(screen.getByRole('button')).toHaveAccessibleName(/unmute/i);
  });
});
