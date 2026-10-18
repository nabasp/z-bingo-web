import { Banner, Button, PageShell } from '@/components/ui';
import { useAnnounceOnFocus } from '@/lib/a11y/useAnnounceOnFocus';
import { GameScreenHeader, OptionSelector } from '@/features/game/components';
import {
  BOARD_SIZES,
  MAX_PLAYERS_OPTIONS,
  TURN_TIMER_OPTIONS,
  turnTimerLabel,
} from '@/features/game/constants';
import { useCreateRoom } from '@/features/game/hooks';
import type { BoardSize } from '@/features/game/types';

export function CreateRoomPage() {
  const {
    boardSize,
    setBoardSize,
    maxPlayers,
    setMaxPlayers,
    turnSeconds,
    setTurnSeconds,
    submit,
    isSubmitting,
    errorMessage,
    existingRoomCode,
    rejoinExisting,
  } = useCreateRoom();

  const headingRef = useAnnounceOnFocus({
    title: 'Create room',
    detail: 'Choose a board size, player count and turn timer, then create the room.',
  });

  // No manual navigation on success: the server flips the room to `lobby` and
  // `useGameFlowNavigation` (mounted on the live game pages) takes it from
  // there — the same server-driven model the mobile app uses.
  const onCreate = () => void submit();

  // One account holds one active room, so the server refuses a second. Offer
  // the way out rather than leaving the player re-pressing a button that will
  // never work.
  const onRejoin = () => void rejoinExisting();

  return (
    <PageShell>
      <GameScreenHeader title="Create Room" headingRef={headingRef} />

      {errorMessage ? <Banner variant="error">{errorMessage}</Banner> : null}

      {existingRoomCode ? (
        <Button variant="secondary" fullWidth loading={isSubmitting} onClick={onRejoin}>
          {`Rejoin ${existingRoomCode}`}
        </Button>
      ) : null}

      <OptionSelector<BoardSize>
        label="Board Size"
        value={boardSize}
        onChange={setBoardSize}
        options={BOARD_SIZES.map(size => ({ value: size, label: `${size}×${size}` }))}
      />

      <OptionSelector<number>
        label="Max Players"
        layout="row"
        value={maxPlayers}
        onChange={setMaxPlayers}
        options={MAX_PLAYERS_OPTIONS.map(n => ({ value: n, label: `${n} Players` }))}
      />

      <OptionSelector<number>
        label="Turn Timer"
        value={turnSeconds}
        onChange={setTurnSeconds}
        options={TURN_TIMER_OPTIONS.map(s => ({ value: s, label: turnTimerLabel(s) }))}
      />

      <Button fullWidth loading={isSubmitting} onClick={onCreate}>
        Create Room
      </Button>
    </PageShell>
  );
}
