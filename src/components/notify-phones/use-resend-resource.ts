"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Poll only while visible, with no overlapping requests or stale responses after mutations. */
export function useResendResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [data, setData] = useState<T | null>(null);

  const [error, setError] = useState<unknown>(null);

  const [loading, setLoading] = useState(true);

  const [revision, setRevision] = useState(0);

  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    controller.current?.abort();
    setRevision((value) => value + 1);
  }, []);

  const replace = useCallback((value: T) => {
    controller.current?.abort();
    setData(value);
    setError(null);
    setLoading(false);
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    const abort = new AbortController();

    controller.current = abort;
    let timer: ReturnType<typeof setTimeout>;

    let first = true;

    const tick = async () => {
      if (abort.signal.aborted) return;

      if (document.visibilityState !== "hidden") {
        if (first) setLoading(true);

        try {
          const result = await load(abort.signal);

          if (!abort.signal.aborted) {
            setData(result);
            setError(null);
          }
        } catch (failure) {
          if (!abort.signal.aborted) setError(failure);
        } finally {
          if (!abort.signal.aborted) setLoading(false);
        }

        first = false;
      }

      if (!abort.signal.aborted) timer = setTimeout(() => void tick(), 5000);
    };

    void tick();

    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [load, revision]);

  return { data, error, loading, refresh, replace };
}
