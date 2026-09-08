import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { VoiceStatus } from '@/features/game/types';
import { VoiceParticipantsContext } from '../context/voiceParticipants';
import { SpeakingRipple } from './SpeakingRipple';

/**
 * The ripple's contract, which is mostly about what it must *not* do.
 *
 * It is decoration layered on top of information that is already stated in
 * words by `StatusBadge`. So the tests worth having are the ones that stop it
 * quietly becoming load-bearing: it must stay out of the accessibility tree,
 * and it must never appear for someone who cannot actually be heard.
 */

function renderWith({
  speaking,
  mic,
  playerId = 'ann',
}: {
  speaking: string[];
  mic: VoiceStatus;
  playerId?: string;
}) {
  return render(
    <VoiceParticipantsContext.Provider
      value={{ mics: new Map([['ann', mic]]), speaking: new Set(speaking) }}>
      <SpeakingRipple playerId={playerId} />
    </VoiceParticipantsContext.Provider>,
  );
}

afterEach(cleanup);

describe('SpeakingRipple', () => {
  it('appears while a live microphone is talking', () => {
    const { container } = renderWith({ speaking: ['ann'], mic: 'mic-on' });
    expect(container.querySelector('.voice-ripple')).not.toBeNull();
  });

  it('stays hidden when nobody is talking', () => {
    const { container } = renderWith({ speaking: [], mic: 'mic-on' });
    expect(container.querySelector('.voice-ripple')).toBeNull();
  });

  it('never appears for a muted microphone', () => {
    // Speaker detection can lag a mute by a frame. A ripple beside a muted
    // player would claim they are audible when they are not.
    const { container } = renderWith({ speaking: ['ann'], mic: 'mic-off' });
    expect(container.querySelector('.voice-ripple')).toBeNull();
  });

  it('shows nothing for a player who is not in the call', () => {
    const { container } = renderWith({
      speaking: ['ann'],
      mic: 'mic-on',
      playerId: 'stranger',
    });
    expect(container.querySelector('.voice-ripple')).toBeNull();
  });

  it('contributes nothing to the accessibility tree', () => {
    // It carries no information a screen-reader user needs — the microphone
    // state is already read out in words next to it.
    const { container } = renderWith({ speaking: ['ann'], mic: 'mic-on' });
    const ripple = container.querySelector('.voice-ripple');

    expect(ripple).toHaveAttribute('aria-hidden', 'true');
    expect(ripple?.textContent).toBe('');
  });

  it('renders without a provider rather than throwing', () => {
    // The roster is rendered in places where voice is not mounted at all.
    const { container } = render(<SpeakingRipple playerId="ann" />);
    expect(container.querySelector('.voice-ripple')).toBeNull();
  });
});
