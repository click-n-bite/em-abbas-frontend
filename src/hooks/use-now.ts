"use client";

import { useEffect, useState } from "react";

/** Current timestamp, re-rendering every `intervalMs` while `enabled`. */
export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    setNow(Date.now());

    const id = window.setInterval(() => setNow(Date.now()), intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  return now;
}
