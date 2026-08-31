/**
 * Test environment setup.
 *
 * Two things every accessibility test needs:
 *
 * 1. `@testing-library/jest-dom`, for matchers that assert what assistive
 *    technology actually computes — `toHaveAccessibleName` resolves the full
 *    ARIA name calculation, which is the thing worth testing rather than the
 *    presence of an attribute.
 * 2. A `<dialog>` shim. jsdom implements the element but not `showModal()`, so
 *    any modal built on it — the right way to get a real focus trap in a
 *    browser — would throw on open.
 */
import '@testing-library/jest-dom/vitest';

/*
 * jsdom has no audio implementation, so preloading the sound effects logs a
 * "Not implemented" line per clip and buries real failures. The app only ever
 * calls these, never reads from them.
 */
for (const method of ['play', 'pause', 'load'] as const) {
  Object.defineProperty(HTMLMediaElement.prototype, method, {
    configurable: true,
    writable: true,
    value: method === 'play' ? () => Promise.resolve() : () => {},
  });
}

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
