import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Chord } from './shortcuts';
import { useShortcut } from './useShortcut';

/**
 * What a shortcut must and must not do.
 *
 * Most of these are about restraint. A global key listener is the easiest way
 * in a web app to break somebody's keyboard — by firing mid-word, by stealing a
 * combination the screen reader owns, or by answering a key that was meant for
 * an open dialog. The negative assertions are the point.
 */

const ALT_B: Chord = { key: 'b', code: 'KeyB', alt: true };

function Harness({ chord, onFire }: { chord: Chord; onFire: () => void }) {
  useShortcut(chord, onFire);
  return (
    <>
      <input aria-label="Room code" />
      <div contentEditable aria-label="Notes" role="textbox" tabIndex={0} />
    </>
  );
}

/** Press a chord at the document, reporting whether the default was prevented. */
function press(init: Partial<KeyboardEventInit>): boolean {
  const event = createEvent.keyDown(document, { bubbles: true, ...init });
  fireEvent(document, event);
  return event.defaultPrevented;
}

afterEach(cleanup);

describe('useShortcut matching', () => {
  it('fires on its chord', () => {
    const onFire = vi.fn();
    render(<Harness chord={ALT_B} onFire={onFire} />);

    press({ key: 'b', code: 'KeyB', altKey: true });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('ignores the bare letter', () => {
    // The whole reason for a chord: a plain `b` belongs to the screen reader.
    const onFire = vi.fn();
    render(<Harness chord={ALT_B} onFire={onFire} />);

    press({ key: 'b', code: 'KeyB' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('requires an exact modifier match', () => {
    // Alt+Shift+B is somebody else's combination; answering it would be theft.
    const onFire = vi.fn();
    render(<Harness chord={ALT_B} onFire={onFire} />);

    press({ key: 'b', code: 'KeyB', altKey: true, shiftKey: true });
    press({ key: 'b', code: 'KeyB', altKey: true, ctrlKey: true });
    press({ key: 'b', code: 'KeyB', altKey: true, metaKey: true });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('survives macOS remapping the letter', () => {
    // Option+B on a Mac produces '∫', not 'b'. Matching on `key` alone would
    // leave this shortcut dead on every Mac in the world.
    const onFire = vi.fn();
    render(<Harness chord={ALT_B} onFire={onFire} />);

    press({ key: '∫', code: 'KeyB', altKey: true });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('ignores an auto-repeating held key', () => {
    const onFire = vi.fn();
    render(<Harness chord={ALT_B} onFire={onFire} />);

    press({ key: 'b', code: 'KeyB', altKey: true, repeat: true });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('matches a bare key such as Escape', () => {
    const onFire = vi.fn();
    render(<Harness chord={{ key: 'Escape' }} onFire={onFire} />);

    press({ key: 'Escape' });
    expect(onFire).toHaveBeenCalledTimes(1);
  });
});

describe('useShortcut restraint', () => {
  it('stays silent while the user is typing', () => {
    // Fired on the input itself, so `event.target` is genuinely the field and
    // the event bubbles the way a real keystroke would.
    const onFire = vi.fn();
    render(<Harness chord={ALT_B} onFire={onFire} />);

    fireEvent.keyDown(screen.getByLabelText('Room code'), {
      key: 'b',
      code: 'KeyB',
      altKey: true,
    });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('stays silent inside a rich-text field', () => {
    const onFire = vi.fn();
    render(<Harness chord={ALT_B} onFire={onFire} />);

    fireEvent.keyDown(screen.getByLabelText('Notes'), {
      key: 'b',
      code: 'KeyB',
      altKey: true,
    });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('stays silent while a dialog is open', () => {
    // A modal makes the rest of the page inert. This is also what stops Escape
    // from reopening the very dialog it just closed.
    const onFire = vi.fn();
    render(<Harness chord={{ key: 'Escape' }} onFire={onFire} />);

    const dialog = document.createElement('dialog');
    dialog.open = true;
    document.body.append(dialog);

    press({ key: 'Escape' });
    expect(onFire).not.toHaveBeenCalled();

    dialog.remove();
    press({ key: 'Escape' });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('does not answer a key another handler already consumed', () => {
    const onFire = vi.fn();
    render(<Harness chord={ALT_B} onFire={onFire} />);

    const event = createEvent.keyDown(document, {
      key: 'b',
      code: 'KeyB',
      altKey: true,
      bubbles: true,
    });
    event.preventDefault();
    fireEvent(document, event);

    expect(onFire).not.toHaveBeenCalled();
  });
});

describe('useShortcut lifecycle', () => {
  it('claims the key it handles', () => {
    // Windows Firefox reads a bare Alt+letter as a menu-bar access key.
    render(<Harness chord={ALT_B} onFire={vi.fn()} />);

    expect(press({ key: 'b', code: 'KeyB', altKey: true })).toBe(true);
  });

  it('stops listening when unmounted', () => {
    const onFire = vi.fn();
    const { unmount } = render(<Harness chord={ALT_B} onFire={onFire} />);
    unmount();

    press({ key: 'b', code: 'KeyB', altKey: true });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('does not stack listeners across re-renders', () => {
    // Every call site passes an inline chord object. If the effect depended on
    // its identity it would resubscribe constantly and fire once per render.
    const onFire = vi.fn();
    const { rerender } = render(
      <Harness chord={{ key: 'b', code: 'KeyB', alt: true }} onFire={onFire} />,
    );
    rerender(<Harness chord={{ key: 'b', code: 'KeyB', alt: true }} onFire={onFire} />);
    rerender(<Harness chord={{ key: 'b', code: 'KeyB', alt: true }} onFire={onFire} />);

    press({ key: 'b', code: 'KeyB', altKey: true });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('honours the latest handler without resubscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness chord={ALT_B} onFire={first} />);
    rerender(<Harness chord={ALT_B} onFire={second} />);

    press({ key: 'b', code: 'KeyB', altKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
