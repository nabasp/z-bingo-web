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
 * 3. A `ResizeObserver` stub. jsdom has none, and `BoardGrid` constructs one in
 *    a layout effect to measure itself for the completed-line overlay — so
 *    without this, rendering the board in a test throws before any assertion
 *    runs.
 */
import { vi } from 'vitest';
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

/*
 * The clips are fetched, not preloaded through the element — see
 * `AudioManager.fetchOne`. Nothing in a test may reach the network, and the
 * loading gate in front of every screen will not open until all 28 settle, so
 * they are served from here instead. A test that wants a failure overrides
 * `fetch` itself.
 */
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
}

vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/audio/')) {
    return new Response(new Blob([new Uint8Array(8)]), { status: 200 });
  }
  throw new Error(`Unexpected fetch in a test: ${url}`);
});

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

/*
 * `ResizeObserver` is unimplemented in jsdom. `BoardGrid` observes itself to
 * size the completed-line strikes; a stub is enough because nothing under test
 * asserts on the measurement, and a width of 0 simply means no strike is drawn.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
