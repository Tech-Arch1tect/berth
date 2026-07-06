import { useSyncExternalStore } from 'react';

export function useVisualViewportHeight(): number {
  return useSyncExternalStore(
    (onChange) => {
      const vv = window.visualViewport;
      if (!vv) return () => {};
      vv.addEventListener('resize', onChange);
      vv.addEventListener('scroll', onChange);
      return () => {
        vv.removeEventListener('resize', onChange);
        vv.removeEventListener('scroll', onChange);
      };
    },
    () => window.visualViewport?.height ?? window.innerHeight,
    () => 0
  );
}
