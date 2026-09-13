import { describe, expect, it } from 'vitest';
import {
  cooldownSecondsLeft,
  needsEmailVerification,
  RESEND_COOLDOWN_MS,
} from './emailVerification';
import type { User } from '@/types';

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    emailVerified: false,
    hasPasswordProvider: true,
    ...overrides,
  };
}

/**
 * The gate decides who reaches the app at all, so the two ways it can be wrong
 * are asymmetric: letting an unverified account through is a missing nudge,
 * while holding a Google account is a permanent lockout — that account has no
 * password and no confirmation mail it can act on.
 */
describe('needsEmailVerification', () => {
  it('holds an unverified email/password account', () => {
    expect(needsEmailVerification(user())).toBe(true);
  });

  it('lets a verified email/password account through', () => {
    expect(needsEmailVerification(user({ emailVerified: true }))).toBe(false);
  });

  it('never holds a provider-only account, verified or not', () => {
    expect(needsEmailVerification(user({ hasPasswordProvider: false }))).toBe(false);
    expect(
      needsEmailVerification(
        user({ hasPasswordProvider: false, emailVerified: true }),
      ),
    ).toBe(false);
  });

  it('has nothing to hold when signed out', () => {
    expect(needsEmailVerification(null)).toBe(false);
  });
});

describe('cooldownSecondsLeft', () => {
  it('is zero before the first send', () => {
    expect(cooldownSecondsLeft(null, 10_000)).toBe(0);
  });

  it('counts down the full window from the last send', () => {
    expect(cooldownSecondsLeft(0, 0)).toBe(RESEND_COOLDOWN_MS / 1000);
    expect(cooldownSecondsLeft(0, 15_000)).toBe(45);
  });

  it('floors at zero once the window has passed', () => {
    expect(cooldownSecondsLeft(0, RESEND_COOLDOWN_MS)).toBe(0);
    expect(cooldownSecondsLeft(0, RESEND_COOLDOWN_MS + 5_000)).toBe(0);
  });

  it('rounds a part-second up, so the label never shows a stale 0', () => {
    expect(cooldownSecondsLeft(0, 59_500)).toBe(1);
  });
});
