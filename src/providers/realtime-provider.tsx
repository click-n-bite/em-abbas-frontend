"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { SOCKJS_URL } from "@/lib/config";
import { useAuth } from "@/providers/auth-provider";

export type ConnectionState = "connecting" | "connected" | "offline";

export interface EventMeta {
  topic: string;
  body: string;
  receivedAt: string;
}

export type RealtimeHandler = (payload: unknown, meta: EventMeta) => void;

interface HandlerEntry {
  id: number;
  handler: RealtimeHandler;
}

interface RealtimeContextValue {
  state: ConnectionState;
  subscribe: (topics: string[], handler: RealtimeHandler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * One STOMP/SockJS connection for the whole portal.
 *
 * The conversation socket used to reconnect whenever the access token rotated
 * (or when a second inbox socket competed with it). During that gap the inbox
 * bell still fired, but `message.created` for the open thread was dropped —
 * so the customer line vanished and the later bot reply still appeared.
 */
export function RealtimeProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { token } = useAuth();

  const [state, setState] = useState<ConnectionState>("offline");

  const handlersByTopic = useRef(new Map<string, HandlerEntry[]>());

  const stompSubs = useRef(new Map<string, StompSubscription>());

  const clientRef = useRef<Client | null>(null);

  const tokenRef = useRef(token);

  const nextId = useRef(0);

  tokenRef.current = token;

  const signedIn = Boolean(token);

  const deliver = useCallback(
    (topic: string) => (frame: IMessage) => {
      const meta: EventMeta = {
        topic,
        body: frame.body,
        receivedAt: new Date().toISOString(),
      };

      let payload: unknown = null;

      try {
        payload = JSON.parse(frame.body);
      } catch {
        payload = null;
      }

      const handlers = handlersByTopic.current.get(topic) ?? [];

      handlers.forEach((entry) => entry.handler(payload, meta));
    },
    [],
  );

  const syncSubscriptions = useCallback(
    (client: Client) => {
      if (!client.connected) return;

      const wanted = new Set(handlersByTopic.current.keys());

      for (const [topic, sub] of stompSubs.current) {
        if (wanted.has(topic)) continue;

        try {
          sub.unsubscribe();
        } catch {
          /* already closed */
        }

        stompSubs.current.delete(topic);
      }

      for (const topic of wanted) {
        if (stompSubs.current.has(topic)) continue;

        stompSubs.current.set(topic, client.subscribe(topic, deliver(topic)));
      }
    },
    [deliver],
  );

  const syncRef = useRef(syncSubscriptions);

  syncRef.current = syncSubscriptions;

  useEffect(() => {
    const client = clientRef.current;

    if (!client || !token) return;

    client.connectHeaders = { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    if (!signedIn) {
      setState("offline");

      return;
    }

    let disposed = false;

    setState("connecting");

    const client = new Client({
      webSocketFactory: () => new SockJS(SOCKJS_URL) as unknown as WebSocket,
      connectHeaders: {
        Authorization: `Bearer ${tokenRef.current ?? ""}`,
      },
      beforeConnect: () => {
        const current = tokenRef.current;

        if (current) {
          client.connectHeaders = { Authorization: `Bearer ${current}` };
        }
      },
      reconnectDelay: 4000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      debug: () => undefined,
    });

    clientRef.current = client;

    client.onConnect = () => {
      if (disposed) return;

      setState("connected");
      stompSubs.current.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch {
          /* already closed */
        }
      });
      stompSubs.current.clear();
      syncRef.current(client);
    };

    client.onWebSocketClose = () => {
      stompSubs.current.clear();

      if (!disposed) setState("connecting");
    };

    client.onStompError = () => {
      if (!disposed) setState("connecting");
    };

    client.activate();

    const subscriptions = stompSubs.current;

    return () => {
      disposed = true;
      clientRef.current = null;
      subscriptions.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch {
          /* already closed */
        }
      });
      subscriptions.clear();
      void client.deactivate();
    };
  }, [signedIn]);

  const subscribe = useCallback(
    (topics: string[], handler: RealtimeHandler) => {
      const id = ++nextId.current;

      const unique = [...new Set(topics.filter(Boolean))];

      unique.forEach((topic) => {
        const list = handlersByTopic.current.get(topic) ?? [];

        list.push({ id, handler });
        handlersByTopic.current.set(topic, list);
      });

      const client = clientRef.current;

      if (client?.connected) syncRef.current(client);

      return () => {
        unique.forEach((topic) => {
          const remaining = (handlersByTopic.current.get(topic) ?? []).filter(
            (entry) => entry.id !== id,
          );

          if (remaining.length === 0) handlersByTopic.current.delete(topic);
          else handlersByTopic.current.set(topic, remaining);
        });

        const current = clientRef.current;

        if (current?.connected) syncRef.current(current);
      };
    },
    [],
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({ state, subscribe }),
    [state, subscribe],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);

  if (!ctx) {
    throw new Error("useRealtime must be used inside <RealtimeProvider>");
  }

  return ctx;
}
