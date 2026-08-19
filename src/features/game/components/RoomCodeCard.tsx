import { useCallback, useState } from 'react';
import { Card, SectionLabel } from '@/components/ui';
import { announcer } from '@/lib/a11y/Announcer';
import { spokenRoomCode } from '@/lib/a11y/phrases';
import { audioManager } from '@/lib/audio/AudioManager';
import { PATHS } from '@/routes/paths';

export interface RoomCodeCardProps {
  code: string;
}

/** A shareable URL that drops the recipient straight into the join form. */
function inviteUrl(code: string): string {
  return `${window.location.origin}${PATHS.joinRoom}?code=${encodeURIComponent(code)}`;
}

/**
 * Centred room-code card with Copy and Share actions.
 *
 * The mobile version has a standing `TODO(clipboard)` — its buttons play a
 * sound and nothing else. On the web both are real: `navigator.clipboard` for
 * Copy, and the Web Share sheet for Share, falling back to copying the invite
 * link where sharing is unavailable (which is most desktop browsers).
 *
 * The outcome is announced as well as shown, because "Copied" appearing on a
 * button is invisible to a screen reader that has already moved on.
 */
export function RoomCodeCard({ code }: RoomCodeCardProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = useCallback(async (text: string, spokenLabel: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
      audioManager.play('room_code_copied');
      announcer.speak(spokenLabel, { assertive: true });
    } catch {
      // Clipboard access is denied outside a secure context (plain http on a
      // LAN IP, for instance). Say so rather than looking like nothing happened.
      setStatus('failed');
      announcer.speak('Could not copy. Read the code out instead.', {
        assertive: true,
      });
    }
    setTimeout(() => setStatus('idle'), 2000);
  }, []);

  const onCopy = useCallback(() => {
    void copy(code, `Room code ${spokenRoomCode(code)} copied`);
  }, [code, copy]);

  const onShare = useCallback(async () => {
    const url = inviteUrl(code);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Bingo room',
          text: `Join my Bingo room: ${code}`,
          url,
        });
        return;
      } catch {
        // A dismissed share sheet is not an error; fall through to copying.
      }
    }
    void copy(url, 'Invite link copied');
  }, [code, copy]);

  return (
    <Card padding="lg" className="flex w-full flex-col items-center gap-3">
      <SectionLabel className="tracking-widest">Room Code</SectionLabel>

      {/* The visible code keeps the hyphen; the spoken one does not, because a
          screen reader either swallows it or reads "hyphen" aloud. */}
      <p
        aria-label={`Room code: ${spokenRoomCode(code)}`}
        className="text-3xl font-bold tracking-tight text-foreground">
        {code}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="min-h-11 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-card">
          {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="min-h-11 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-card">
          Share
        </button>
      </div>
    </Card>
  );
}
