import { useEffect, useRef } from 'react';
import type { Chord } from './shortcuts';

/**
 * Bind a keyboard shortcut for as long as the component is mounted.
 *
 * There is deliberately no central registry of live handlers: each shortcut is
 * owned by the component that can act on it, so it exists exactly while that
 * action is possible and disappears with it. Binding Escape in the game screen
 * means Escape cannot leave a game you are not in.
 *
 * The listener sits on `document` in the bubble phase, which is what lets the
 * board's own arrow-key handling win: React delegates to a root inside `body`,
 * so component handlers run first and anything they consume never reaches here.
 */

export interface ShortcutOptions {
  /** Unbind without unmounting the caller. Default true. */
  enabled?: boolean;
  /** Default true. Suppresses browser defaults such as Firefox's Alt menu. */
  preventDefault?: boolean;
  /** Default false — a held key should not repeat a toggle. */
  allowRepeat?: boolean;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const TYPING_ROLES = '[contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"]';

/**
 * Is the user typing?
 *
 * A shortcut that fires mid-word is worse than no shortcut, and `Alt` chords
 * are close enough to real text-editing combinations to matter.
 */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  // Key events can be dispatched at `document` or `window`, which have no
  // `closest` and are never somewhere you can type.
  if (!element || typeof element.closest !== 'function') return false;
  if (element.isContentEditable) return true;
  if (TYPING_TAGS.has(element.tagName)) return true;
  return element.closest(TYPING_ROLES) !== null;
}

/**
 * Is a dialog open?
 *
 * `showModal()` makes the rest of the page inert, so nothing behind it should
 * respond. This is also what stops Escape fighting the dialog it just opened:
 * the browser's close-request is a *default action* that runs after the event
 * has finished bubbling, so a document listener still sees Escape while a
 * dialog is open. Without this guard one press would close the confirmation and
 * immediately reopen it, leaving it impossible to dismiss from the keyboard.
 *
 * Queried from the DOM rather than tracked in React state on purpose — state is
 * a snapshot from the last render and would race the dialog's own `cancel`.
 * `dialog[open]` rather than `:modal`, which jsdom does not implement.
 */
function isDialogOpen(target: EventTarget | null): boolean {
  const doc = (target as Node | null)?.ownerDocument ?? document;
  return doc.querySelector('dialog[open]') !== null;
}

export function useShortcut(
  chord: Chord,
  onFire: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {},
): void {
  // The handler is almost always an inline closure; behind a ref it can change
  // every render without re-subscribing.
  const fireRef = useRef(onFire);
  useEffect(() => {
    fireRef.current = onFire;
  });

  const { key, code, alt = false, ctrl = false, shift = false, meta = false } = chord;
  const { enabled = true, preventDefault = true, allowRepeat = false } = options;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.repeat && !allowRepeat) return;

      // Exact match, so Alt+Shift+B never fires an Alt+B binding — that space
      // belongs to the browser and the screen reader.
      if (
        event.altKey !== alt ||
        event.ctrlKey !== ctrl ||
        event.shiftKey !== shift ||
        event.metaKey !== meta
      ) {
        return;
      }

      const matches =
        event.key.toLowerCase() === key.toLowerCase() ||
        (code !== undefined && event.code === code);
      if (!matches) return;

      if (isTyping(event.target) || isDialogOpen(event.target)) return;

      if (preventDefault) event.preventDefault();
      fireRef.current(event);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // Primitives, never the `chord` / `options` objects: every call site passes
    // an object literal, so depending on identity would resubscribe on every
    // render.
  }, [key, code, alt, ctrl, shift, meta, enabled, preventDefault, allowRepeat]);
}
