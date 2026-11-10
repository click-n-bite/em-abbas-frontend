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
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { usePoll } from "@/hooks/use-poll";
import { useRealtime } from "@/hooks/use-realtime";
import { playMessageSound, unlockSoundOnFirstInteraction } from "@/lib/sound";
import { useAuth } from "./auth-provider";
import type { AppNotification } from "@/lib/types";

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  errorKey: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

function shouldRefreshNotifications(
  payload: Record<string, unknown> | null,
): boolean {
  const name = typeof payload?.event === "string" ? payload.event : "";

  if (!name) return false;

  if (name === "handoff.requested" || name === "conversation.assigned")
    return true;

  if (/lead|notification/i.test(name)) return true;

  return (
    name === "conversation.upserted" &&
    payload?.lastMessageDirection === "inbound"
  );
}

export function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { token, agent } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);

  const [unread, setUnread] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);

  const [failure, setFailure] = useState<string | null>(null);

  const inFlight = useRef<boolean>(false);

  const pending = useRef<boolean>(false);

  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    unlockSoundOnFirstInteraction();
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (!token) return;

    if (inFlight.current) {
      pending.current = true;

      return;
    }

    inFlight.current = true;

    try {
      const [listResponse, unreadCount] = await Promise.all([
        api.notifications(false),
        api.notificationsUnreadCount(),
      ]);

      setItems(listResponse);
      setUnread(unreadCount);
      setFailure(null);
    } catch (error) {
      setFailure(errorKey(error));
    } finally {
      inFlight.current = false;
      setLoading(false);

      if (pending.current) {
        pending.current = false;
        void refreshRef.current();
      }
    }
  }, [token]);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!token) {
      setItems([]);
      setUnread(0);
      setLoading(false);

      return;
    }

    setLoading(true);
    void refresh();
  }, [token, refresh]);

  usePoll(() => void refresh(), 30000, Boolean(token));

  useEffect(() => {
    if (!token || !("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "ema-notification") void refresh();
    };

    navigator.serviceWorker.addEventListener("message", onMessage);

    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [token, refresh]);

  const topics = useMemo(
    () => (agent ? ["/topic/inbox", `/topic/agent/${agent.id}`] : []),
    [agent],
  );

  useRealtime({
    topics,
    enabled: Boolean(token && agent),
    onEvent: (raw) => {
      const payload = raw as Record<string, unknown> | null;

      if (shouldRefreshNotifications(payload)) void refresh();

      if (payload?.event === "handoff.requested") {
        playMessageSound();
      } else if (
        payload?.event === "conversation.upserted" &&
        payload.lastMessageDirection === "inbound"
      ) {
        playMessageSound();
      }
    },
  });

  const markRead = useCallback(
    async (id: string): Promise<void> => {
      const wasUnread = items.find((item) => item.id === id)?.read === false;

      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, read: true, readAt: new Date().toISOString() }
            : item,
        ),
      );

      if (wasUnread) setUnread((current) => Math.max(0, current - 1));

      try {
        await api.markNotificationRead(id);
      } catch {
        void refresh();
      }
    },
    [items, refresh],
  );

  const markAllRead = useCallback(async (): Promise<void> => {
    const unreadIds = items.filter((item) => !item.read).map((item) => item.id);

    if (unreadIds.length === 0) return;

    const now = new Date().toISOString();

    setItems((current) =>
      current.map((item) => ({
        ...item,
        read: true,
        readAt: item.readAt ?? now,
      })),
    );
    setUnread(0);

    try {
      await api.markAllNotificationsRead();
    } catch {
      void refresh();
    }
  }, [items, refresh]);

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unread,
      loading,
      errorKey: failure,
      refresh,
      markRead,
      markAllRead,
    }),
    [items, unread, loading, failure, refresh, markRead, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);

  if (!ctx)
    throw new Error(
      "useNotifications must be used inside <NotificationsProvider>",
    );

  return ctx;
}
