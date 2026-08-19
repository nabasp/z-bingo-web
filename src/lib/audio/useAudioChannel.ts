import { useSyncExternalStore } from 'react';
import { audioManager } from './AudioManager';
import type { AudioChannel } from './audioChannels';

/** Live on/off state for one audio channel, for settings and in-game toggles. */
export function useAudioChannel(channel: AudioChannel): boolean {
  const channels = useSyncExternalStore(
    audioManager.subscribe,
    audioManager.getChannelsSnapshot,
    audioManager.getChannelsSnapshot,
  );
  return channels[channel];
}

/** All three at once, for the settings screen. */
export function useAudioChannels(): Record<AudioChannel, boolean> {
  return useSyncExternalStore(
    audioManager.subscribe,
    audioManager.getChannelsSnapshot,
    audioManager.getChannelsSnapshot,
  );
}
