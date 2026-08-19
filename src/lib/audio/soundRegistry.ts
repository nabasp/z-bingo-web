/**
 * Ported verbatim from the React Native app: `bingo/src/lib/audio/soundRegistry.ts`.
 * Pure logic — no React Native, no DOM. Keep the two copies in sync;
 * the mobile file is the original.
 */

/**
 * The single source of truth for every sound the app can play.
 *
 * The clips are the same 28 `.wav` files the mobile app ships, copied from
 * `bingo/src/assets/audio/<category>/` into `public/audio/` — FLATTENED, exactly
 * as the native asset pipeline flattens them into each platform bundle. That is
 * why every `file` here is a bare basename, why they must stay globally unique,
 * and why this registry needed no edits when it was ported.
 */

export type SoundKey =
  // Room & lobby
  | 'room_created'
  | 'lobby_joined'
  | 'ready_confirmed'
  | 'everyone_ready'
  | 'player_left'
  | 'player_reconnected'
  | 'room_closed'
  | 'room_code_copied'
  // Board setup
  | 'board_shuffled'
  | 'board_submitted'
  | 'board_reset'
  | 'board_invalid'
  | 'cell_select'
  | 'cell_swap'
  // Gameplay
  | 'game_start'
  | 'your_turn'
  | 'opponent_turn'
  | 'number_called'
  | 'number_marked'
  | 'countdown_tick'
  | 'turn_timeout'
  // Progress
  | 'line_complete'
  | 'letter_earned'
  | 'near_win'
  | 'opponent_line'
  | 'opponent_near_win'
  // Result
  | 'you_win'
  | 'you_lose';

import type { AudioChannel } from './audioChannels';

export type SoundCategory = 'room' | 'setup' | 'game' | 'progress' | 'result';

export interface SoundDefinition {
  /** Bare filename as it exists in the native bundle. */
  file: string;
  category: SoundCategory;
  /**
   * Which switchable output this belongs to. Everything shipped today is an
   * effect; background loops will declare `'music'` when those assets land.
   */
  channel?: AudioChannel;
  /**
   * Higher wins. While an `exclusive` sound is playing, anything with a lower
   * priority is dropped rather than queued — the win/lose stinger should never
   * be talked over by a stray turn cue.
   */
  priority: number;
  /** Per-clip trim, applied on top of the global volume. */
  volume: number;
  /**
   * Silences everything currently playing and suppresses lower-priority sounds
   * for the length of the clip.
   */
  exclusive?: boolean;
}

export const SOUNDS: Record<SoundKey, SoundDefinition> = {
  // ── Result ───────────────────────────────────────────────────────────────
  you_win: {
    file: 'you_win.wav',
    category: 'result',
    priority: 100,
    volume: 1,
    exclusive: true,
  },
  you_lose: {
    file: 'you_lose.wav',
    category: 'result',
    priority: 100,
    volume: 1,
    exclusive: true,
  },

  // ── Room collapse ────────────────────────────────────────────────────────
  // The room falls back to the lobby mid-setup because too many players left.
  room_closed: { file: 'room_closed.wav', category: 'room', priority: 75, volume: 1 },

  // ── Gameplay ─────────────────────────────────────────────────────────────
  game_start: { file: 'game_start.wav', category: 'game', priority: 80, volume: 1 },
  your_turn: { file: 'your_turn.wav', category: 'game', priority: 60, volume: 0.9 },
  turn_timeout: {
    file: 'turn_timeout.wav',
    category: 'game',
    priority: 62,
    volume: 1,
  },
  // Fires three times in a row (3-2-1), so it is trimmed well back.
  countdown_tick: {
    file: 'countdown_tick.wav',
    category: 'game',
    priority: 55,
    volume: 0.7,
  },
  // The most frequent cue in a match — deliberately the quietest of the pair
  // so it never competes with `your_turn`.
  opponent_turn: {
    file: 'opponent_turn.wav',
    category: 'game',
    priority: 35,
    volume: 0.6,
  },
  // Mutually exclusive with `number_called` — see `deriveAudioEvents`.
  number_marked: {
    file: 'number_marked.wav',
    category: 'game',
    priority: 50,
    volume: 0.8,
  },
  // Quiet source (peaks around -13 dBFS), so it gets no further trim.
  number_called: {
    file: 'number_called.wav',
    category: 'game',
    priority: 50,
    volume: 1,
  },

  // ── Progress ─────────────────────────────────────────────────────────────
  letter_earned: {
    file: 'letter_earned.wav',
    category: 'progress',
    priority: 70,
    volume: 1,
  },
  line_complete: {
    file: 'line_complete.wav',
    category: 'progress',
    priority: 65,
    volume: 0.9,
  },
  // Replaces `letter_earned` on the line that puts you one away from winning.
  near_win: { file: 'near_win.wav', category: 'progress', priority: 68, volume: 1 },
  // Faint by design — a threat cue that should register without demanding focus.
  opponent_near_win: {
    file: 'opponent_near_win.wav',
    category: 'progress',
    priority: 58,
    volume: 1,
  },
  // Very quiet at the source (-35.6 dBFS peak); see docs/audio-report.md.
  opponent_line: {
    file: 'opponent_line.wav',
    category: 'progress',
    priority: 45,
    volume: 1,
  },

  // ── Room & lobby ─────────────────────────────────────────────────────────
  everyone_ready: {
    file: 'everyone_ready.wav',
    category: 'room',
    priority: 40,
    volume: 0.9,
  },
  room_created: { file: 'room_created.wav', category: 'room', priority: 30, volume: 1 },
  lobby_joined: { file: 'lobby_joined.wav', category: 'room', priority: 30, volume: 0.9 },
  ready_confirmed: {
    file: 'ready_confirmed.wav',
    category: 'room',
    priority: 30,
    volume: 0.9,
  },
  player_left: { file: 'player_left.wav', category: 'room', priority: 40, volume: 1 },
  player_reconnected: {
    file: 'player_reconnected.wav',
    category: 'room',
    priority: 35,
    volume: 0.9,
  },
  room_code_copied: {
    file: 'room_code_copied.wav',
    category: 'room',
    priority: 15,
    volume: 0.8,
  },

  // ── Board setup ──────────────────────────────────────────────────────────
  // Both setup clips are under-level at the source (board_submitted peaks near
  // -36 dBFS); they run at full gain and are flagged in docs/audio-report.md.
  board_submitted: {
    file: 'board_submitted.wav',
    category: 'setup',
    priority: 30,
    volume: 1,
  },
  board_shuffled: {
    file: 'board_shuffled.wav',
    category: 'setup',
    priority: 20,
    volume: 1,
  },
  board_invalid: {
    file: 'board_invalid.wav',
    category: 'setup',
    priority: 22,
    volume: 0.8,
  },
  board_reset: { file: 'board_reset.wav', category: 'setup', priority: 18, volume: 0.9 },
  // Cell taps come in fast bursts while arranging a board, so both sit low in
  // the mix and low in priority.
  cell_swap: { file: 'cell_swap.wav', category: 'setup', priority: 12, volume: 0.7 },
  cell_select: { file: 'cell_select.wav', category: 'setup', priority: 10, volume: 0.7 },
};

export const SOUND_KEYS = Object.keys(SOUNDS) as SoundKey[];
