import { PageHeading, PageShell, SettingToggle } from '@/components/ui';
import { setNotation, useNotation } from '@/lib/a11y/notation';
import { BOARD_KEYS, SHORTCUTS } from '@/lib/a11y/shortcuts';
import {
  isSpeechSynthesisSupported,
  setSelfVoiceEnabled,
  useSelfVoiceEnabled,
} from '@/lib/a11y/speechEngine';
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
  const selfVoice = useSelfVoiceEnabled();
  const speechSupported = isSpeechSynthesisSupported();
  const notation = useNotation();

  const headingRef = useAnnounceOnFocus({
    title: 'Settings',
    detail: 'Audio channels, speech, board coordinates and vibration.',
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
          description="Game events are announced as they happen"
          value={channels.speech}
          onChange={next => audioManager.setChannelEnabled('speech', next)}
          hint="Turning this off leaves navigation and rejections spoken — they are how you find your way around, not commentary."
        />

        {/* Everything above goes into an ARIA live region, where the screen
            reader owns the timing and nothing can be cancelled. This is the
            other path: the app's own voice, with real interruption — and the
            only one a keyboard player without a screen reader ever hears. */}
        <SettingToggle
          label="Speak aloud"
          description="The game reads updates in its own voice"
          value={selfVoice && speechSupported}
          onChange={setSelfVoiceEnabled}
          disabled={!speechSupported}
          hint={
            speechSupported
              ? 'Leave this off if you use a screen reader — it is already reading these, and two voices would say everything twice.'
              : 'This browser has no speech synthesis.'
          }
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

      <section className="flex w-full flex-col gap-4">
        <PageHeading
          level={2}
          title="Board coordinates"
          subtitle="How cells are named when they are read out"
        />

        <SettingToggle
          label="Chess coordinates"
          description={
            notation === 'chess'
              ? 'Cells read as B2 — column letter, then row number'
              : 'Cells read as R2, C2 — row number, then column number'
          }
          value={notation === 'chess'}
          onChange={next => setNotation(next ? 'chess' : 'rowcol')}
          hint="Chess is shorter and reads better in a list. Row and column is clearer about which axis is which."
        />
      </section>

      <section className="flex w-full flex-col gap-4">
        <PageHeading level={2} title="Keyboard shortcuts" />

        {/* Rendered from the same table the shortcuts are bound from, so this
            list cannot describe behaviour the app does not have. A definition
            list, because that is what this is: a key and what it does. */}
        <dl className="flex w-full flex-col gap-3">
          {Object.entries(SHORTCUTS).map(([name, shortcut]) => (
            <div key={name} className="flex items-baseline justify-between gap-4">
              <dt>
                <kbd className="rounded-md border border-border bg-card px-2 py-1 font-mono text-sm text-foreground">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="flex-1 text-right text-sm text-muted-foreground">
                {shortcut.description}
              </dd>
            </div>
          ))}
        </dl>

        <p className="px-1 text-sm text-muted-foreground">
          The board also works with the arrow keys: move between cells, then
          press Enter or Space to call a number.
        </p>

        <PageHeading
          level={3}
          title="On the board"
          subtitle="Single keys, which work while the board has focus"
        />

        {/* Rendered from the same table the grid binds from, so this list
            cannot describe a key the board does not answer. */}
        <dl className="flex w-full flex-col gap-3">
          {BOARD_KEYS.map(spec => (
            <div key={spec.key} className="flex items-baseline justify-between gap-4">
              <dt>
                <kbd className="rounded-md border border-border bg-card px-2 py-1 font-mono text-sm text-foreground">
                  {spec.keys}
                </kbd>
              </dt>
              <dd className="flex-1 text-right text-sm text-muted-foreground">
                {spec.description}
              </dd>
            </div>
          ))}
        </dl>

        <p className="px-1 text-sm text-muted-foreground">
          These are single letters rather than combinations because the board is
          a grid: screen readers switch to focus mode inside one and pass every
          key straight through. Away from the board they would be claimed for
          screen-reader navigation, which is why the shortcuts above are
          combinations.
        </p>
      </section>
    </PageShell>
  );
}
