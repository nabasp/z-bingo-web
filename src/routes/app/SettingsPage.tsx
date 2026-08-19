import { PageHeading, PageShell, SettingToggle } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import {
  areHapticsSupported,
  setHapticsEnabled,
  useHapticsEnabled,
} from '@/lib/a11y/haptics';
import { audioManager } from '@/lib/audio/AudioManager';
import { useAudioChannels } from '@/lib/audio/useAudioChannel';

export function SettingsPage() {
  const channels = useAudioChannels();
  const haptics = useHapticsEnabled();
  const hapticsSupported = areHapticsSupported();

  const headingRef = useAnnounceOnFocus({
    title: 'Settings',
    detail: 'Audio channels and vibration.',
  });

  return (
    <PageShell>
      <PageHeading headingRef={headingRef} title="Settings" />

      <section className="flex w-full flex-col gap-4">
        <PageHeading
          level={2}
          title="Audio"
          subtitle="Each channel is remembered separately"
        />

        <SettingToggle
          label="Music"
          description="Background music during lobbies and matches"
          value={channels.music}
          onChange={next => audioManager.setChannelEnabled('music', next)}
        />

        <SettingToggle
          label="Sound effects"
          description="Numbers called, lines completed, and win or lose cues"
          value={channels.sfx}
          onChange={next => audioManager.setChannelEnabled('sfx', next)}
          hint="Quietened automatically while the game is announcing something."
        />

        <SettingToggle
          label="Spoken updates"
          description="Game events are announced for screen readers"
          value={channels.speech}
          onChange={next => audioManager.setChannelEnabled('speech', next)}
          // Unlike on mobile — where this drives the phone's TTS out loud — the
          // web version writes into an ARIA live region. Nobody without a
          // screen reader hears or sees anything, which is why it is on by
          // default and why turning it off only costs you something.
          hint="Silent unless you use a screen reader, which reads them aloud."
        />

        {/* No music assets ship yet — say so rather than let the switch look
            broken when nothing happens. */}
        <p className="px-1 text-sm text-muted-foreground">
          Music is not included in this build yet, so the Music switch has no
          effect for now.
        </p>
      </section>

      <section className="flex w-full flex-col gap-4">
        <PageHeading level={2} title="Feedback" />

        <SettingToggle
          label="Vibration"
          description="A short buzz when you mark a number or complete a line"
          value={haptics && hapticsSupported}
          onChange={setHapticsEnabled}
          disabled={!hapticsSupported}
          hint={
            hapticsSupported
              ? 'Follows your system vibration setting.'
              : 'This browser or device has no vibration support.'
          }
        />
      </section>
    </PageShell>
  );
}
