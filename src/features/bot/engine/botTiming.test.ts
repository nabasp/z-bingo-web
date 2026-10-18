import { describe, expect, it } from 'vitest';
import { BOT_MAX_DELAY_MS, BOT_MIN_DELAY_MS, botDelayMs } from './botTiming';

describe('botDelayMs', () => {
  it('stays inside the configured window', () => {
    for (let i = 0; i < 200; i++) {
      const delay = botDelayMs();
      expect(delay).toBeGreaterThanOrEqual(BOT_MIN_DELAY_MS);
      expect(delay).toBeLessThanOrEqual(BOT_MAX_DELAY_MS);
    }
  });

  it('varies, so the bot never falls into a rhythm', () => {
    // A constant delay is as robotic as none, only slower.
    const seen = new Set(Array.from({ length: 100 }, () => botDelayMs()));
    expect(seen.size).toBeGreaterThan(10);
  });

  it('maps the two ends of the range', () => {
    expect(botDelayMs(() => 0)).toBe(BOT_MIN_DELAY_MS);
    expect(botDelayMs(() => 1)).toBe(BOT_MAX_DELAY_MS);
  });
});
