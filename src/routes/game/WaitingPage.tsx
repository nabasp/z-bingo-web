import { PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { WaitingCard } from '@/features/game/components';
import { useWaiting } from '@/features/game/hooks';

/**
 * Shown after your board is locked in.
 *
 * There is no timer: the server flips the room to `playing` once everyone has
 * submitted, and `useGameFlowNavigation` moves us on.
 */
export function WaitingPage() {
  const { players, doneIds, readyCount, totalCount } = useWaiting();

  useAnnounceOnFocus({
    title: 'Waiting for players',
    detail: `${readyCount} of ${totalCount} boards locked in. The game starts on its own once everyone is ready.`,
    key: `${readyCount}/${totalCount}`,
  });

  return (
    <PageShell center width="narrow">
      <WaitingCard
        title="Waiting for players"
        subtitle="The game starts once everyone has locked in a board"
        readyCount={readyCount}
        totalCount={totalCount}
        players={players}
        doneIds={doneIds}
      />
    </PageShell>
  );
}
