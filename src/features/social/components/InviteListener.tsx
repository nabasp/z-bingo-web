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
      const code = await respondToInvite(incomingInvite.id, true);
      // No code means the join was refused — the room filled, started or
      // closed while the invitation sat there. The reason is already in the
      // social error banner, so stay put rather than navigating nowhere.
      if (code) navigate(PATHS.lobby);
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
