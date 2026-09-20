import { describe, expect, it } from 'vitest';
import {
  BOARD_KEYS,
  boardKeysFor,
  describeBoardKey,
  describeBoardKeyForReference,
  describeShortcuts,
  SHORTCUTS,
  shortcutsFor,
} from './shortcuts';

/**
 * The shortcut tables are the app's only record of what the keyboard does:
 * the bindings, the spoken help, the Settings list and the guide all read
 * from them. So what is tested here is that the table stays a table anyone
 * can trust — one key per job, and never a claim about a screen that does not
 * answer it.
 *
 * The descriptions themselves are deliberately not pinned. That would test
 * prose rather than behaviour, and the wording is meant to be edited.
 */

describe('BOARD_KEYS', () => {
  it('gives each key one job', () => {
    const keys = BOARD_KEYS.map(spec => spec.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('binds the keys the board is asked for', () => {
    // Enter and the arrows are the grid's own, and Alt+B and Alt+M are chords,
    // so these are the letters left.
    expect(BOARD_KEYS.map(spec => spec.key).sort()).toEqual(
      ['A', 'B', 'C', 'D', 'F', 'H', 'M', 'P', 'R', 'S', 'U'].sort(),
    );
  });

  it('keeps the setup-only keys off the game board', () => {
    const play = boardKeysFor('play').map(spec => spec.key);
    expect(play).not.toContain('F');
    expect(play).not.toContain('U');
    expect(boardKeysFor('setup').map(spec => spec.key)).toEqual(
      expect.arrayContaining(['F', 'U']),
    );
  });

  it('keeps scores off setup and fill off play, the two the stages disagree on', () => {
    expect(boardKeysFor('setup').map(spec => spec.key)).not.toContain('S');
    expect(boardKeysFor('play').map(spec => spec.key)).toContain('S');
  });
});

describe('SHORTCUTS', () => {
  it('only offers Escape where it is bound', () => {
    // The setup page deliberately has no confirmed exit, so a help text that
    // named Escape there would be describing a key that does nothing.
    expect(shortcutsFor('play')).toContain(SHORTCUTS.exitGame);
    expect(shortcutsFor('setup')).not.toContain(SHORTCUTS.exitGame);
  });

  it('keeps the board round trip and the mic on both stages', () => {
    for (const stage of ['setup', 'play'] as const) {
      expect(shortcutsFor(stage)).toContain(SHORTCUTS.focusBoard);
      expect(shortcutsFor(stage)).toContain(SHORTCUTS.toggleMic);
    }
  });
});

describe('describeShortcuts', () => {
  it('reads out the chords as well as the letters', () => {
    // This is what H is for: before it, the chords were spoken once on
    // arrival and never again, which is no help to anyone who forgot one.
    const help = describeShortcuts('play');
    expect(help).toContain(SHORTCUTS.focusBoard.spoken);
    expect(help).toContain(SHORTCUTS.toggleMic.spoken);
    expect(help).toContain(SHORTCUTS.exitGame.spoken);
  });

  it('names no key the stage does not bind', () => {
    const setup = describeShortcuts('setup');
    expect(setup).not.toContain(SHORTCUTS.exitGame.spoken);
    expect(setup).not.toContain(describeBoardKey(
      BOARD_KEYS.find(spec => spec.key === 'S')!,
      'play',
    ));
  });

  it('describes a key by what it does on this stage', () => {
    const rowKey = BOARD_KEYS.find(spec => spec.key === 'R')!;
    expect(describeShortcuts('setup')).toContain(describeBoardKey(rowKey, 'setup'));
    expect(describeShortcuts('play')).toContain(describeBoardKey(rowKey, 'play'));
  });

  it('says what Enter does here, which is the one key that differs outright', () => {
    expect(describeShortcuts('setup')).toContain('Enter. Put the next number');
    expect(describeShortcuts('play')).toContain('Enter. Call this number.');
  });
});

describe('describeBoardKeyForReference', () => {
  it('gives both stages when they differ', () => {
    const row = BOARD_KEYS.find(spec => spec.key === 'R')!;
    const text = describeBoardKeyForReference(row);
    expect(text).toContain('Setting up:');
    expect(text).toContain('Playing:');
  });

  it('says so when a key belongs to one stage only', () => {
    expect(describeBoardKeyForReference(BOARD_KEYS.find(s => s.key === 'U')!)).toContain(
      'setting your board up only',
    );
    expect(describeBoardKeyForReference(BOARD_KEYS.find(s => s.key === 'S')!)).toContain(
      'During a game only',
    );
  });

  it('does not repeat itself when a key means the same thing throughout', () => {
    const text = describeBoardKeyForReference(BOARD_KEYS.find(s => s.key === 'M')!);
    expect(text).not.toContain('Setting up:');
  });
});
