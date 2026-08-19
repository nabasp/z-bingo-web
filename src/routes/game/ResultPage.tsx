import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageHeading, PageShell, SectionLabel } from '@/components/ui';
import { list, ordinal, plural, sentence } from '@/lib/a11y/phrases';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { useAuth } from '@/features/auth/context';
import { RankingRow, ResultHeader } from '@/features/game/components';
import { useGameSocket } from '@/features/game/context';
import type { GameResult, RankingEntry } from '@/features/game/types';
import { PATHS } from '../paths';

export function ResultPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { room, winner, isHost, rematch, leaveRoom } = useGameSocket();

  /**
   * Build the summary from the server's results: rank by letters earned, with
   * the declared winner always first.
   */
  const result = useMemo<GameResult | null>(() => {
    if (!room) return null;

    const winnerId = winner?.winnerId ?? room.winnerId;
    const winnerName = room.players.find(p => p.id === winnerId)?.name ?? 'Someone';
    const youWon = winnerId === user?.id;

    const rows = winner?.results ?? [];
    const ranked = [...rows].sort((a, b) => {
      if (a.playerId === winnerId) return -1;
      if (b.playerId === winnerId) return 1;
      return b.letters - a.letters;
    });

    const rankings: RankingEntry[] = ranked.map((entry, index) => ({
      playerId: entry.playerId,
      name: entry.playerId === user?.id ? 'You' : entry.name,
      place: index + 1,
      detail: `${entry.letters}/${room.size} letters · ${entry.lines.length} line${
        entry.lines.length === 1 ? '' : 's'
      }`,
    }));

    return {
      winnerName: youWon ? 'You' : winnerName,
      reason: `Completed ${room.size} lines to spell ${room.word}`,
      turns: room.callHistory.length,
      rankings,
    };
  }, [room, winner, user?.id]);

  /**
   * The whole outcome in one utterance.
   *
   * This page is pure summary — a blind player should not have to tab through
   * three ranking rows to learn whether they won, so the headline result and
   * the standings are announced on arrival.
   */
  const headingRef = useAnnounceOnFocus({
    title: result
      ? result.winnerName === 'You'
        ? 'You win!'
        : `${result.winnerName} wins`
      : 'Game over',
    detail: result
      ? sentence(
          result.reason,
          `Game lasted ${plural(result.turns, 'turn')}`,
          list(
            result.rankings.map(
              entry => `${ordinal(entry.place)}, ${entry.name}, ${entry.detail}`,
            ),
          ),
        )
      : 'This game has ended.',
    key: result?.winnerName,
  });

  const returnHome = () => {
    leaveRoom();
    navigate(PATHS.home, { replace: true });
  };

  if (!result) {
    return (
      <PageShell center width="narrow">
        <PageHeading
          headingRef={headingRef}
          align="center"
          title="Game over"
          subtitle="This game has ended."
        />
        <Button fullWidth onClick={returnHome}>
          Return Home
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell center>
      <ResultHeader result={result} headingRef={headingRef} />

      <section className="flex w-full flex-col gap-3">
        <SectionLabel>Final Rankings</SectionLabel>
        <div role="list" className="flex flex-col gap-3">
          {result.rankings.map((entry, index) => (
            <RankingRow key={entry.playerId} entry={entry} seatIndex={index} />
          ))}
        </div>
      </section>

      <div className="flex w-full flex-col gap-4">
        {isHost ? (
          <Button fullWidth onClick={() => rematch()}>
            Play Again
          </Button>
        ) : null}
        <Button variant="outline" fullWidth onClick={returnHome}>
          Return Home
        </Button>
      </div>
    </PageShell>
  );
}
