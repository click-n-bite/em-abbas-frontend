import { request, unwrapList } from "@/lib/http";
import type { AppNotification } from "@/lib/types";
import type { Mode } from "@/lib/features/conversations/types";

interface RawNotificationPayload {
  phone?: string;
  customerName?: string;
  serviceName?: string;
  conversationId?: string;
  leadId?: string;
  mode?: Mode;
  [key: string]: unknown;
}

interface RawNotification {
  id: number;
  eventType: string;
  title: string;
  body: string | null;
  entityType?: string;
  entityId?: string;
  payload?: RawNotificationPayload;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const toAppNotification = (raw: RawNotification): AppNotification => ({
  id: String(raw.id),
  type: raw.eventType,
  title: raw.title,
  body: raw.body,
  read: raw.isRead,
  readAt: raw.readAt,
  conversationId:
    raw.payload?.conversationId ??
    (raw.entityType === "conversation" && raw.entityId != null
      ? String(raw.entityId)
      : null) ??
    null,
  leadId: raw.payload?.leadId ?? null,
  phone: raw.payload?.phone ?? null,
  customerName: raw.payload?.customerName ?? null,
  serviceName: raw.payload?.serviceName ?? null,
  mode: raw.payload?.mode ?? null,
  preview: null,
  createdAt: raw.createdAt,
});

export const notificationsApi = {
  async list(
    unreadOnly = false,
    signal?: AbortSignal,
  ): Promise<AppNotification[]> {
    const payload = await request<unknown>(
      `/api/notifications?unreadOnly=${unreadOnly}`,
      { signal },
    );

    const rawItems = unwrapList<RawNotification>(payload, "data");

    return rawItems.map(toAppNotification);
  },

  async unreadCount(signal?: AbortSignal): Promise<number> {
    const payload = await request<{ data?: { unreadCount?: number } }>(
      `/api/notifications/unread-count`,
      { signal },
    );

    return payload?.data?.unreadCount ?? 0;
  },

  markRead(id: string): Promise<void> {
    return request<void>(`/api/notifications/${id}/read`, { method: "POST" });
  },

  markAllRead(): Promise<void> {
    return request<void>(`/api/notifications/read-all`, { method: "POST" });
  },
};
