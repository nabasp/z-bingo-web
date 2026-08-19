import {
  defaultFor,
  type AudioChannel,
  type ChannelPreferences,
} from './audioChannels';

/**
 * Channel defaults for the browser.
 *
 * The shared `resolveChannels` takes a `screenReaderEnabled` flag, because on
 * Android the app can ask. **The web has no equivalent** — there is no reliable,
 * non-fingerprinting way to detect a screen reader, and every technique that
 * claims to is a heuristic that gets it wrong. So the flag is not available and
 * the defaults are decided differently here:
 *
 * - `music`, `sfx` — the sighted default (`defaultFor(…, false)`), i.e. on.
 * - `speech` — **on**, where native defaults it off unless TalkBack is running.
 *   Native "speech" is the app talking out loud through the TTS engine, which
 *   would be intrusive for someone who does not need it. Web "speech" is text
 *   written into an ARIA live region: a screen reader reads it, and everyone
 *   else neither hears nor sees anything. There is nothing to protect a sighted
 *   player from, and gating it would silence the one channel that makes the
 *   game followable without sight.
 *
 * An explicit choice still wins in both cases — `null` means "never set", and
 * only then does a default apply.
 */
export function resolveWebChannels(
  preferences: ChannelPreferences,
): Record<AudioChannel, boolean> {
  return {
    music: preferences.music ?? defaultFor('music', false),
    sfx: preferences.sfx ?? defaultFor('sfx', false),
    speech: preferences.speech ?? true,
  };
}
