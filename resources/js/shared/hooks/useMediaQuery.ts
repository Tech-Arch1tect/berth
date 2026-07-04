import { useSyncExternalStore } from 'react';

export const DESKTOP_MIN_WIDTH = 1024;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
}
