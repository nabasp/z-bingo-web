import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banner, Button, PageShell, SectionLabel } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import {
  GameScreenHeader,
  InviteCard,
  RoomCodeInput,
} from '@/features/game/components';
import { useJoinRoom } from '@/features/game/hooks';

/** Invitations have no backend yet; same switch as the Home page. */
const SHOW_MOCK_DATA = false;

export function JoinRoomPage() {
  const [searchParams] = useSearchParams();
  const {
    code,
    setCode,
    isValid,
    invitations,
    declineInvitation,
    submit,
    isSubmitting,
    errorMessage,
  } = useJoinRoom();

  const headingRef = useAnnounceOnFocus({
    title: 'Join room',
    detail: 'Enter the two-word room code you were given.',
  });

  /**
   * Pre-fill from `?code=brave-otter`.
   *
   * This is what makes the lobby's Share button useful: the link it copies
   * lands here with the code already typed. A native app has no equivalent
   * without deep-link plumbing.
   */
  const codeParam = searchParams.get('code');
  useEffect(() => {
    if (codeParam) setCode(codeParam);
  }, [codeParam, setCode]);

  // On success the server puts us in the room and the flow navigation moves us
  // to the lobby.
  const join = (roomCode: string) => void submit(roomCode);

  return (
    <PageShell>
      <GameScreenHeader title="Join Room" headingRef={headingRef} />

      {errorMessage ? <Banner variant="error">{errorMessage}</Banner> : null}

      <form
        className="flex w-full flex-col gap-4"
        onSubmit={event => {
          event.preventDefault();
          if (isValid) join(code);
        }}>
        <SectionLabel>Room Code</SectionLabel>
        <RoomCodeInput value={code} onChange={setCode} />
        <Button type="submit" fullWidth disabled={!isValid} loading={isSubmitting}>
          Join Room
        </Button>
      </form>

      {SHOW_MOCK_DATA && invitations.length > 0 ? (
        <section className="flex w-full flex-col gap-3">
          <SectionLabel>Pending Invitations</SectionLabel>
          {invitations.map(invitation => (
            <InviteCard
              key={invitation.id}
              invitation={invitation}
              onJoin={() => join(invitation.roomCode)}
              onDecline={() => declineInvitation(invitation.id)}
            />
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}
