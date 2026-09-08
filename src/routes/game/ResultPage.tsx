import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfirmDialog,
  PageHeading,
  PageShell,
  SectionLabel,
} from '@/components/ui';
import { announcer } from '@/lib/a11y/Announcer';
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
  const { room, winner, rematch, declineRematch, rematchOffer, leaveRoom } =
    useGameSocket();
  const [waitingFor, setWaitingFor] = useState<string[] | null>(null);
  const [asking, setAsking] = useState(false);

  /**
   * Ask for another round.
   *
   * Any player may ask — it used to be host-only, which left a room whose host
   * had gone quiet unable to play again at all. The answer says whether the
   * round started or who it is still waiting on, and that wait is shown rather
   * than left as a button that appears to do nothing.
   */
  const askForRematch = useCallback(async () => {
    setAsking(true);
    try {
      const state = await rematch();
      setWaitingFor(state.started ? null : state.waitingFor);
      if (!state.started) {
        announcer.speak(
          sentence('Waiting for', list(state.waitingFor), 'to answer'),
          { assertive: true, dedupeKey: 'rematch' },
        );
      }
    } catch (error) {
      announcer.speak(
        error instanceof Error ? error.message : 'Could not ask for another game.',
        { assertive: true, dedupeKey: 'rematch' },
      );
    } finally {
      setAsking(false);
    }
  }, [rematch]);

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
        <Button fullWidth loading={asking} onClick={() => void askForRematch()}>
          Play Again
        </Button>
        {waitingFor && waitingFor.length > 0 ? (
          <p role="status" className="text-center text-sm text-muted-foreground">
            Waiting for {list(waitingFor)} to answer.
          </p>
        ) : null}
        <Button variant="outline" fullWidth onClick={returnHome}>
          Return Home
        </Button>
      </div>

      {/*
        Somebody else asked. Everyone has to agree, so declining ends the room
        for all of them — which the dialog says outright rather than leaving it
        to be discovered.
      */}
      <ConfirmDialog
        open={rematchOffer !== null}
        title="Play again?"
        message={`${rematchOffer?.fromName ?? 'A player'} wants another game. If you say no, the room closes for everyone.`}
        confirmLabel="Play again"
        cancelLabel="No thanks"
        onConfirm={() => void askForRematch()}
        onCancel={declineRematch}
      />
    </PageShell>
  );
}
