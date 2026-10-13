import { useCallback, useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 767px)';

/** true while the CSS media query matches. */
export default function useMediaQuery(query) {
  const subscribe = useCallback((listener) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
