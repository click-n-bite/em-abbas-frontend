"use client";

import { useEffect, useRef } from "react";
import {
  useRealtimeContext,
  type ConnectionState,
  type EventMeta,
  type RealtimeHandler,
} from "@/providers/realtime-provider";

export type { ConnectionState, EventMeta };

interface Options {
  topics: string[];
  onEvent: RealtimeHandler;
  enabled?: boolean;
}

export function useRealtime({
  topics,
  onEvent,
  enabled = true,
}: Options): ConnectionState {
  const { state, subscribe } = useRealtimeContext();

  const handlerRef = useRef(onEvent);

  handlerRef.current = onEvent;

  const topicKey = topics.filter(Boolean).sort().join("|");

  useEffect(() => {
    if (!enabled || !topicKey) return;

    return subscribe(topicKey.split("|"), (payload, meta) => {
      handlerRef.current(payload, meta);
    });
  }, [enabled, subscribe, topicKey]);

  if (!enabled || !topicKey) return "offline";

  return state;
}
