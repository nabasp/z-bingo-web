/**
 * The two ARIA live regions everything spoken by the app goes through.
 *
 * These are the web stand-in for React Native's
 * `AccessibilityInfo.announceForAccessibility`. They are owned here rather than
 * rendered by a component because {@link announcer} is a module singleton used
 * from outside React (the socket feedback bridge, hooks, event handlers).
 *
 * Both regions must exist in the DOM *before* text is written into them — a
 * screen reader that has not yet observed the node will not announce its
 * initial content. `mountLiveRegions()` therefore runs at bootstrap, before
 * React renders.
 */

/** Visually hidden but still rendered — `display: none` is not announced. */
const HIDDEN_STYLE =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;' +
  'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;';

let polite: HTMLElement | null = null;
let assertive: HTMLElement | null = null;

function createRegion(politeness: 'polite' | 'assertive'): HTMLElement {
  const node = document.createElement('div');
  node.setAttribute('aria-live', politeness);
  node.setAttribute('aria-atomic', 'true');
  // `status` / `alert` give assistive tech the right implicit semantics even
  // where `aria-live` alone is handled inconsistently.
  node.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
  node.setAttribute('style', HIDDEN_STYLE);
  document.body.appendChild(node);
  return node;
}

/** Idempotent. Call once at startup. */
export function mountLiveRegions(): void {
  if (typeof document === 'undefined' || polite) return;
  polite = createRegion('polite');
  assertive = createRegion('assertive');
}

/**
 * Write a message into a region.
 *
 * The region is cleared first: writing the same string twice in a row is a
 * no-op to the DOM, and a screen reader would never see a change to announce.
 */
export function publish(text: string, isAssertive: boolean): void {
  mountLiveRegions();
  const node = isAssertive ? assertive : polite;
  if (!node) return;

  node.textContent = '';
  // A separate frame, so the clear and the write are two distinct mutations.
  requestAnimationFrame(() => {
    node.textContent = text;
  });
}

/** Empty both regions — used when leaving a screen mid-announcement. */
export function clearLiveRegions(): void {
  if (polite) polite.textContent = '';
  if (assertive) assertive.textContent = '';
}
