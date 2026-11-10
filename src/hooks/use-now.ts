"use client";

import { useEffect, useState } from "react";

/**
 * Current timestamp, refreshed on an interval and whenever
 * the browser tab becomes visible.
 *
 * @param enabled Whether automatic updates are enabled.
 * @param intervalMs Refresh interval in milliseconds.
 * @returns Current timestamp.
 */
export function useNow(
  enabled: boolean = true,
  intervalMs: number = 30_000,
): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const tick = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
      }
    };

    // Update immediately.
    setNow(Date.now());

    // Refresh periodically.
    const intervalId = window.setInterval(tick, intervalMs);

    // Refresh when the tab becomes visible.
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, intervalMs]);

  return now;
}
