import { apiClient } from '@/lib/apiClient';
import type {
  GameDetailsResponse,
  HistoryFilter,
  HistoryResponse,
  LeaderboardResponse,
  MyRankingResponse,
} from './history.types';

/**
 * Read-only calls for history and rankings.
 *
 * There is nothing here that writes. Results are recorded by the server as
 * games end; a client has no way to submit one, which is the whole of the
 * anti-cheating story.
 */

function query(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

export const historyApi = {
  games(options: { filter?: HistoryFilter; limit?: number; cursor?: string } = {}) {
    return apiClient.request<HistoryResponse>(`/api/games${query(options)}`);
  },

  game(id: string) {
    return apiClient.request<GameDetailsResponse>(`/api/games/${encodeURIComponent(id)}`);
  },

  leaderboard(options: { limit?: number; cursor?: string } = {}) {
    return apiClient.request<LeaderboardResponse>(`/api/leaderboard${query(options)}`);
  },

  me() {
    return apiClient.request<MyRankingResponse>('/api/leaderboard/me');
  },
};
