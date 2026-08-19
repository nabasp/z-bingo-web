import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { audioManager } from '@/lib/audio/AudioManager';
import { mountLiveRegions } from '@/lib/a11y/liveRegion';

/**
 * The live regions must exist in the DOM before anything writes to them — a
 * screen reader that has not yet observed the node will not announce its
 * initial content. So they are mounted before React renders.
 */
mountLiveRegions();

/**
 * Browsers block audio until the page has had a real user gesture. The first
 * click or key press primes every clip; after that, game-driven cues (which
 * happen nowhere near an interaction) are allowed through. `once` means this
 * costs nothing for the rest of the session.
 */
const unlock = () => audioManager.unlock();
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
