"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRealtime, type ConnectionState } from "@/hooks/use-realtime";
import type { VoiceRealtimeEvent } from "@/lib/features/voice/types";

export interface VoiceRefreshInfo {
  /** Event names received since the last refresh. */
  events: Set<string>;
  /** True when the refresh was triggered by (re)connecting the socket. */
  reconnect: boolean;
}

interface Options {
  topics: string[];
  onRefresh: (info: VoiceRefreshInfo) => void;
  enabled?: boolean;
  /** Minimum gap between refreshes, so heartbeats don't flood REST. */
  coalesceMs?: number;
}

const SEEN_LIMIT = 300;

/**
 * Voice WebSocket events are refresh hints only. This hook:
 * - ignores anything that is not a `voice.*` event,
 * - de-duplicates by `eventId` (the same event can arrive on two topics),
 * - coalesces bursts into a single `onRefresh`,
 * - asks for a refresh again after every reconnect (no replay on the socket).
 */
export function useVoiceEvents({
  topics,
  onRefresh,
  enabled = true,
  coalesceMs = 700,
}: Options): ConnectionState {
  const refreshRef = useRef(onRefresh);

  refreshRef.current = onRefresh;

  const seen = useRef(new Set<string>());

  const pending = useRef(new Set<string>());

  const reconnectPending = useRef(false);

  const timer = useRef<number | null>(null);

  const schedule = useCallback(() => {
    if (timer.current !== null) return;

    timer.current = window.setTimeout(() => {
      timer.current = null;

      const events = pending.current;

      const reconnect = reconnectPending.current;

      pending.current = new Set();
      reconnectPending.current = false;
      refreshRef.current({ events, reconnect });
    }, coalesceMs);
  }, [coalesceMs]);

  const state = useRealtime({
    topics,
    enabled,
    onEvent: (payload) => {
      const event = payload as Partial<VoiceRealtimeEvent> | null;

      if (!event || typeof event.event !== "string") return;

      if (!event.event.startsWith("voice.")) return;

      if (event.eventId) {
        if (seen.current.has(event.eventId)) return;

        seen.current.add(event.eventId);

        if (seen.current.size > SEEN_LIMIT) {
          const oldest = seen.current.values().next().value;

          if (oldest !== undefined) seen.current.delete(oldest);
        }
      }

      pending.current.add(event.event);
      schedule();
    },
  });

  const previous = useRef<ConnectionState>(state);

  useEffect(() => {
    if (enabled && state === "connected" && previous.current !== "connected") {
      reconnectPending.current = true;
      schedule();
    }

    previous.current = state;
  }, [state, enabled, schedule]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);

      timer.current = null;
    },
    [],
  );

  return state;
}
