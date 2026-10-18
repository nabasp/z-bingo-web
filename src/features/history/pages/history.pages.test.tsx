import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announcer } from '@/lib/a11y/Announcer';
import { ApiError } from '@/lib/apiClient';
import type {
  GameDetails,
  HistoryItem,
  HistoryResponse,
  LeaderboardEntry,
} from '../history.types';
import { GameDetailsPage } from './GameDetailsPage';
import { GameHistoryPage } from './GameHistoryPage';
import { LeaderboardPage } from './LeaderboardPage';

/**
 * History and rankings on the web, asserted the way assistive technology sees
 * them: accessible names, `aria-pressed`, where focus goes, and what is said.
 */

vi.mock('../history.api', () => ({
  historyApi: {
    games: vi.fn(),
    game: vi.fn(),
    leaderboard: vi.fn(),
    me: vi.fn(),
  },
}));

const { historyApi } = (await import('../history.api')) as unknown as {
  historyApi: Record<'games' | 'game' | 'leaderboard' | 'me', ReturnType<typeof vi.fn>>;
};

beforeEach(() => {
  vi.spyOn(announcer, 'speak');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function item(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'a82f0000-0000-4000-8000-000000000000',
    shortId: 'A82F',
    size: 5,
    startedAt: 0,
    endedAt: Date.UTC(2026, 9, 6, 12),
    durationMs: 252_000,
    status: 'completed',
    result: 'won',
    rank: 1,
    playerCount: 3,
    winnerName: 'Ann',
    isWinner: true,
    ...overrides,
  };
}

function page(games: HistoryItem[], nextCursor?: string): HistoryResponse {
  return { success: true, games, nextCursor };
}

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    rank: 1,
    displayName: 'Ann',
    gamesPlayed: 48,
    wins: 21,
    winRate: 0.4375,
    points: 125,
    isYou: false,
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/history" element={<GameHistoryPage />} />
        <Route path="/history/:gameId" element={<GameDetailsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GameHistoryPage', () => {
  it('makes each game a link whose name starts with what it visibly says', async () => {
    // WCAG 2.5.3: a voice-control user says "click Bingo #A82F". The name has
    // to contain that, or the command finds nothing.
    historyApi.games.mockResolvedValue(page([item()]));
    renderAt('/history');

    const link = await screen.findByRole('link', { name: /^Bingo #A82F\. Won, first place\./ });
    expect(link).toHaveAttribute('href', '/history/a82f0000-0000-4000-8000-000000000000');
  });

  it('reads the result before the detail, and names a winner who was not you', async () => {
    historyApi.games.mockResolvedValue(
      page([item({ result: 'lost', rank: 2, isWinner: false })]),
    );
    renderAt('/history');
    expect(
      await screen.findByRole('link', { name: /Lost, second place\. Winner: Ann\./ }),
    ).toBeInTheDocument();
  });

  it('marks the chosen filter as pressed, and asks the server for it', async () => {
    historyApi.games.mockResolvedValue(page([item()]));
    renderAt('/history');
    await screen.findByRole('link', { name: /Bingo #A82F/ });

    const filters = within(screen.getByRole('group', { name: 'Filter games' }));
    expect(filters.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(filters.getByRole('button', { name: 'Wins' }));
    await waitFor(() =>
      expect(historyApi.games).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'wins' })),
    );
    expect(filters.getByRole('button', { name: 'Wins' })).toHaveAttribute('aria-pressed', 'true');
    expect(filters.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it("never shows an earlier filter's answer under a later one", async () => {
    let resolveWins!: (value: HistoryResponse) => void;
    historyApi.games.mockImplementation(({ filter }: { filter: string }) => {
      if (filter === 'wins') return new Promise(resolve => (resolveWins = resolve));
      if (filter === 'losses') {
        return Promise.resolve(
          page([item({ id: 'l', shortId: 'L0SS', result: 'lost', rank: 2, isWinner: false })]),
        );
      }
      return Promise.resolve(page([]));
    });
    renderAt('/history');
    await screen.findByText('No games yet');

    fireEvent.click(screen.getByRole('button', { name: 'Wins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Losses' }));
    await screen.findByRole('link', { name: /Bingo #L0SS/ });

    await act(async () => {
      resolveWins(page([item({ id: 'w', shortId: 'W1NS' })]));
    });
    expect(screen.queryByRole('link', { name: /Bingo #W1NS/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Bingo #L0SS/ })).toBeInTheDocument();
  });

  it('moves focus to the first new game, so loading the last page does not lose it', async () => {
    // The bug: on the last page "Load more" disappears while focused, and the
    // browser drops focus to <body> — back to the top of the page.
    historyApi.games
      .mockResolvedValueOnce(page([item({ id: '1', shortId: 'AAA1' })], 'next'))
      .mockResolvedValueOnce(page([item({ id: '2', shortId: 'BBB2' }), item({ id: '3', shortId: 'CCC3' })]));
    renderAt('/history');

    const more = await screen.findByRole('button', { name: 'Load more games' });
    more.focus();
    fireEvent.click(more);

    const firstNew = await screen.findByRole('link', { name: /Bingo #BBB2/ });
    await waitFor(() => expect(firstNew).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Load more games' })).toBeNull();
    expect(announcer.speak).toHaveBeenCalledWith('2 more games loaded.', expect.anything());
  });

  it('explains an empty history and offers a way to play', async () => {
    historyApi.games.mockResolvedValue(page([]));
    renderAt('/history');

    expect(await screen.findByText('No games yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Find a Game' }));
    expect(await screen.findByText('Home')).toBeInTheDocument();
  });

  it('says what went wrong, and lets the player try again', async () => {
    historyApi.games
      .mockRejectedValueOnce(new ApiError(0, 'network', 'Network error.'))
      .mockResolvedValueOnce(page([item()]));
    renderAt('/history');

    expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: /Bingo #A82F/ })).toBeInTheDocument();
  });
});

describe('LeaderboardPage', () => {
  it('puts your own ranking before the list, under its own heading', async () => {
    historyApi.leaderboard.mockResolvedValue({
      success: true,
      period: 'all',
      players: [entry(), entry({ rank: 2, displayName: 'Bob' })],
    });
    historyApi.me.mockResolvedValue({
      success: true,
      period: 'all',
      me: entry({ rank: 27, displayName: 'Navas', points: 82, isYou: true }),
    });
    renderAt('/leaderboard');

    const mine = await screen.findByRole('heading', { name: 'Your ranking' });
    const top = screen.getByRole('heading', { name: 'Top players' });
    expect(mine.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByText('Rank 27. Navas. 82 points. 48 games, 21 wins. 43.8 percent win rate'),
    ).toBeInTheDocument();
  });

  it('names every number in a row for anyone who cannot see the columns', async () => {
    historyApi.leaderboard.mockResolvedValue({ success: true, period: 'all', players: [entry()] });
    historyApi.me.mockResolvedValue({ success: true, period: 'all', me: null });
    renderAt('/leaderboard');

    const list = await screen.findByRole('list', { name: 'Top players' });
    expect(within(list).getByRole('listitem')).toHaveTextContent(
      'Rank 1. Ann. 125 points. 48 games, 21 wins. 43.8 percent win rate',
    );
  });

  it('tells someone who has never finished a game that they are not ranked yet', async () => {
    historyApi.leaderboard.mockResolvedValue({ success: true, period: 'all', players: [] });
    historyApi.me.mockResolvedValue({ success: true, period: 'all', me: null });
    renderAt('/leaderboard');

    expect(await screen.findByText(/Not ranked yet/)).toBeInTheDocument();
    expect(screen.getByText('No rankings yet')).toBeInTheDocument();
  });
});

const details: GameDetails = {
  id: 'a82f0000-0000-4000-8000-000000000000',
  shortId: 'A82F',
  size: 5,
  word: 'BINGO',
  startedAt: 0,
  endedAt: Date.UTC(2026, 9, 6, 12),
  durationMs: 252_000,
  status: 'completed',
  endReason: 'bingo',
  winnerName: 'Ann',
  players: [
    { name: 'Ann', seat: 0, letters: 5, rank: 1, result: 'won', isYou: false, isWinner: true },
    { name: 'Bob', seat: 1, letters: 3, rank: 2, result: 'lost', isYou: true, isWinner: false },
    { name: 'Cat', seat: 2, letters: 1, rank: 3, result: 'left', isYou: false, isWinner: false },
  ],
};

describe('GameDetailsPage', () => {
  it('lists the standings in order, marking you and naming an abandonment', async () => {
    historyApi.game.mockResolvedValue({ success: true, game: details });
    renderAt(`/history/${details.id}`);

    const standings = await screen.findByRole('list');
    const rows = within(standings).getAllByRole('listitem').map(li => li.textContent);
    expect(rows[0]).toContain('first place, Ann. Won. 5 letters');
    expect(rows[1]).toContain('second place, Bob, you. Lost. 3 letters');
    expect(rows[2]).toContain('third place, Cat. Abandoned. 1 letter');
  });

  it('pairs each fact with its name', async () => {
    historyApi.game.mockResolvedValue({ success: true, game: details });
    renderAt(`/history/${details.id}`);

    await screen.findByText('Final standings');
    const terms = screen.getAllByRole('term').map(t => t.textContent);
    expect(terms).toEqual(['Date', 'Duration', 'Board', 'Word']);
    expect(screen.getByText('4 minutes 12 seconds')).toBeInTheDocument();
  });

  it('says plainly when the game cannot be found', async () => {
    historyApi.game.mockRejectedValue(
      new ApiError(404, 'game_not_found', 'That game could not be found.'),
    );
    renderAt(`/history/${details.id}`);

    expect(await screen.findByText('That game could not be found.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to game history/ })).toBeInTheDocument();
  });
});
