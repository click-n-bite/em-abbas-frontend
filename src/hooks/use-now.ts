"use client";

import { useEffect, useState } from "react";

/**
 * Current time, refreshed on an interval and whenever the tab becomes visible.
 * Relative labels ("18 min ago") read this so they stay current without a reload.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs <= 0) return;

    const tick = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };

    const id = window.setInterval(tick, intervalMs);

    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);

  return now;
}
