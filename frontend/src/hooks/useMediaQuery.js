import { useCallback, useSyncExternalStore } from 'react';

// The design's breakpoints (components/ui/README.md): phone up to 899px (tab bar and sheets), two columns
// from 900px (players fold into the top bar's dial), three columns from 1100px.
export const PHONE_QUERY = '(max-width: 899px)';
export const DESKTOP_QUERY = '(min-width: 1100px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** true while the CSS media query matches. */
export default function useMediaQuery(query) {
  const subscribe = useCallback((listener) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/** For code outside React (animations): does the viewer ask for less motion right now? */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED_MOTION_QUERY).matches;
}
