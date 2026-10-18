import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import { useSocial } from '../context';
import { InviteDialog } from './InviteDialog';

/**
 * Shows an incoming invitation wherever the player happens to be.
 *
 * Mounted once in the authenticated shell rather than on the Friends page: an
 * invitation is worth interrupting for from anywhere, and a modal that only
 * exists on one screen would silently drop invitations arriving on any other.
 *
 * It lives inside the router because accepting navigates. `useGameFlowNavigation`
 * only runs under the game routes, so a room joined from Home or Friends sets
 * state but moves nobody — this hands over to the lobby, and the flow
 * navigation takes it from there.
 */
export function InviteListener() {
  const navigate = useNavigate();
  const { incomingInvite, respondToInvite } = useSocial();
  const [busy, setBusy] = useState(false);

  const accept = useCallback(async () => {
    if (!incomingInvite) return;
    setBusy(true);
    try {
      const status = await respondToInvite(incomingInvite.id, true);

      /*
       * Accepting has two good outcomes, and they go to different places.
       *
       * `joined` means that acceptance filled the game and the room now
       * exists, so the lobby is real. `waiting` means the seat is theirs but
       * the game still needs someone — there is no room to show yet, so they
       * go to the page that says who is in and how many are still needed.
       * Sending a waiting player to the lobby would bounce them straight home
       * off the room guard, which is exactly what it used to do.
       */
      if (status === 'joined') navigate(PATHS.lobby);
      else if (status === 'waiting') navigate(PATHS.playWithFriends);
      // `declined` and `failed` stay put — the reason is in the error banner.
    } finally {
      setBusy(false);
    }
  }, [incomingInvite, respondToInvite, navigate]);

  const decline = useCallback(() => {
    if (!incomingInvite || busy) return;
    void respondToInvite(incomingInvite.id, false);
  }, [incomingInvite, respondToInvite, busy]);

  return (
    <InviteDialog
      invite={incomingInvite}
      onAccept={() => void accept()}
      onDecline={decline}
      busy={busy}
    />
  );
}
