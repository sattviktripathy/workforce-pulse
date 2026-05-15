"use client";

import { useSyncExternalStore, type RefObject } from "react";

/** Measured client width of an element, via ResizeObserver, with an SSR
 *  snapshot of 0. Used to feed Recharts an explicit width so it never
 *  computes a -1 dimension (which logs a console warning). No effects, so
 *  it satisfies react-hooks/set-state-in-effect. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  return useSyncExternalStore(
    (onChange) => {
      const el = ref.current;
      if (!el || typeof ResizeObserver === "undefined") return () => {};
      const ro = new ResizeObserver(onChange);
      ro.observe(el);
      return () => ro.disconnect();
    },
    () => ref.current?.clientWidth ?? 0,
    () => 0,
  );
}
