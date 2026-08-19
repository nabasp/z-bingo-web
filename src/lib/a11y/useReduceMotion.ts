import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the player has asked the system to reduce motion.
 *
 * Vestibular disorders make large transitions genuinely unpleasant, and the
 * setting is a direct request. The base stylesheet already neutralises CSS
 * animations; this hook is for the cases JavaScript decides, mirroring
 * `bingo/src/lib/a11y/useReduceMotion.ts`.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof matchMedia === 'function' && matchMedia(QUERY).matches,
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduceMotion;
}
