"use client";

import { useEffect, useRef } from "react";

export function usePoll(
  callback: () => void,
  intervalMs: number,
  enabled = true,
) {
  const ref = useRef(callback);

  ref.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const tick = () => {
      if (document.visibilityState === "visible") ref.current();
    };

    const id = window.setInterval(tick, intervalMs);

    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, intervalMs]);
}
