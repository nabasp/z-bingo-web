import { describe, expect, it } from 'vitest';
import { isValidRoomCode, normalizeRoomCode } from './index';

/**
 * The client half of the room-code contract.
 *
 * These rules must match the server's `ROOM_CODE_PATTERN` and
 * `normalizeRoomCode` exactly, and the mobile client's copy of them. A mismatch
 * is not a cosmetic bug: a code the server issues but a client rejects produces
 * a room nobody can enter, which is precisely what the old digit-suffix
 * collision fallback did.
 */
describe('room code validation', () => {
  it('accepts the two-word form the server issues', () => {
    for (const code of ['brave-otter', 'silver-heron', 'cosmic-pelican']) {
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it('rejects anything with a digit in it', () => {
    expect(isValidRoomCode('brave-otter2')).toBe(false);
    expect(normalizeRoomCode('brave-otter2')).toBe('brave-otter');
  });

  it('rejects a single word and an empty code', () => {
    expect(isValidRoomCode('brave')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
    expect(isValidRoomCode('-')).toBe(false);
  });

  it('lowercases and strips characters that are not part of a code', () => {
    expect(normalizeRoomCode('BRAVE-OTTER')).toBe('brave-otter');
    expect(normalizeRoomCode('br@ve-0tter!')).toBe('brve-tter');
  });

  it('accepts every word pair the expanded server keyspace can produce', () => {
    // The server grew its lists from 24×24 to 128×128 to reach the 5,000-room
    // target. The client contract is the *shape*, not the vocabulary.
    for (const code of ['gleeful-wombat', 'crimson-juniper', 'sturdy-glacier']) {
      expect(isValidRoomCode(code)).toBe(true);
    }
  });
});
