"use client";

import { useCallback, useEffect, useState } from "react";
import { voiceApi } from "@/lib/features/voice/api";
import { usePoll } from "@/hooks/use-poll";
import { useVoiceEvents } from "@/hooks/use-voice-events";

/** Number of calls currently live (`status=active`), for the nav indicator. */
export function useLiveCallCount(): number {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const page = await voiceApi.list({ status: "active", page: 0, size: 1 });

      setCount(page.total ?? 0);
    } catch {
      // Voice API may not be deployed yet; keep the last known value.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useVoiceEvents({
    topics: ["/topic/voice/calls"],
    onRefresh: () => void load(),
  });

  usePoll(() => void load(), 30_000, count > 0);

  return count;
}
