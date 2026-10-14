// prefers-reduced-motion for the board: the camera cuts instead of flying and the turn ring doesn't pulse.
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null;

export function prefersReducedMotion() {
  return !!media?.matches;
}

function subscribe(onChange) {
  if (!media) return () => {};
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
