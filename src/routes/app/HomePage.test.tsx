import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

/**
 * Home's two new sections: recent games and top players.
 *
 * Both used to be a hardcoded empty state behind a mock switch. What matters
 * now is that each is a titled section a screen reader can jump to, that each
 * says something useful when there is nothing to show, and that "view all"
 * is a link — it goes somewhere.
 */

vi.mock('@/features/auth/context', () => ({
  useAuth: () => ({ user: { fullName: 'Navas Example' } }),
}));

vi.mock('@/features/game/context', () => ({
  useGameSocket: () => ({ notice: null, clearNotice: vi.fn() }),
}));

vi.mock('@/features/history/history.api', () => ({
  historyApi: { games: vi.fn(), leaderboard: vi.fn(), game: vi.fn(), me: vi.fn() },
}));

const { historyApi } = (await import('@/features/history/history.api')) as unknown as {
  historyApi: Record<'games' | 'leaderboard', ReturnType<typeof vi.fn>>;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage history and rankings', () => {
  it('shows recent games and top players as titled sections', async () => {
    historyApi.games.mockResolvedValue({
      success: true,
      games: [
        {
          id: 'a82f0000-0000-4000-8000-000000000000',
          shortId: 'A82F',
          size: 5,
          startedAt: 0,
          endedAt: Date.UTC(2026, 9, 6),
          durationMs: 60_000,
          status: 'completed',
          result: 'won',
          rank: 1,
          playerCount: 2,
          winnerName: 'Navas',
          isWinner: true,
        },
      ],
    });
    historyApi.leaderboard.mockResolvedValue({
      success: true,
      period: 'all',
      players: [
        { rank: 1, displayName: 'Ann', gamesPlayed: 4, wins: 3, winRate: 0.75, points: 10, isYou: false },
      ],
    });
    renderHome();

    const recent = await screen.findByRole('region', { name: 'Recent Games' });
    expect(within(recent).getByRole('link', { name: /^Bingo #A82F\. Won, first place/ })).toBeInTheDocument();
    expect(within(recent).getByRole('link', { name: /View all games/ })).toHaveAttribute('href', '/history');

    const top = screen.getByRole('region', { name: 'Top Players' });
    expect(within(top).getByText(/Rank 1\. Ann\. 10 points/)).toBeInTheDocument();
    expect(within(top).getByRole('link', { name: /View leaderboard/ })).toHaveAttribute('href', '/leaderboard');
  });

  it('asks for only a preview, not the whole history', async () => {
    historyApi.games.mockResolvedValue({ success: true, games: [] });
    historyApi.leaderboard.mockResolvedValue({ success: true, period: 'all', players: [] });
    renderHome();
    await screen.findByText('No games yet');

    expect(historyApi.games).toHaveBeenCalledWith({ limit: 3 });
    expect(historyApi.leaderboard).toHaveBeenCalledWith({ limit: 3 });
  });

  it('explains both empty states for someone who has never played', async () => {
    historyApi.games.mockResolvedValue({ success: true, games: [] });
    historyApi.leaderboard.mockResolvedValue({ success: true, period: 'all', players: [] });
    renderHome();

    expect(await screen.findByText('No games yet')).toBeInTheDocument();
    expect(
      screen.getByText('Join a bingo game to start building your game history.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('No rankings yet')).toBeInTheDocument();
    // Still offered: the leaderboard is also where your own standing lives.
    expect(screen.getByRole('link', { name: /View leaderboard/ })).toBeInTheDocument();
    // No "view all" for a history that has nothing in it.
    expect(screen.queryByRole('link', { name: /View all games/ })).toBeNull();
  });
});
