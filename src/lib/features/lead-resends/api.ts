import { request, unwrapItem } from "@/lib/http";

export type BatchStatus =
  | "draft"
  | "expired"
  | "active"
  | "completed"
  | "completed_with_errors"
  | "cancelled";

export type LeadHandlingStatus = "open" | "in_progress";

export type ItemStatus =
  | "pending"
  | "queued"
  | "failed_retryable"
  | "sent"
  | "dead"
  | "skipped"
  | "cancelled";

export interface ResendBatch {
  id: string;
  status: BatchStatus;
  recipientPhone: string;
  recipientName: string;
  createdBy: number | null;
  createdAt: string;
  expiresAt: string;
  startedAt: string | null;
  cancelledAt: string | null;
  total: number;
  pending: number;
  sending: number;
  retrying: number;
  sent: number;
  failed: number;
  skipped: number;
  cancelled: number;
  intervalSeconds: number;
  nextSendAt: string | null;
}

export interface ResendItem {
  id: number;
  leadId: number;
  status: ItemStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
}

export interface ResendPage<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

const base = "/api/leads/resend-batches";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return unwrapItem<T>(await request<unknown>(path, { signal }), "data");
}

async function action(
  id: string,
  operation: "start" | "retry-failed" | "cancel",
) {
  return unwrapItem<ResendBatch>(
    await request<unknown>(`${base}/${encodeURIComponent(id)}/${operation}`, {
      method: "POST",
    }),
    "data",
  );
}

export const leadResendsApi = {
  async preview(
    phoneNumber: string,
    recipientName: string,
    statuses: LeadHandlingStatus[] = ["open", "in_progress"],
  ): Promise<ResendBatch> {
    return unwrapItem<ResendBatch>(
      await request<unknown>(`${base}/preview`, {
        method: "POST",
        body: {
          phoneNumber,
          recipientName: recipientName.trim() || undefined,
          statuses,
        },
      }),
      "data",
    );
  },
  list: (page: number, signal?: AbortSignal) =>
    get<ResendPage<ResendBatch>>(`${base}?page=${page}&size=10`, signal),
  get: (id: string, signal?: AbortSignal) =>
    get<ResendBatch>(`${base}/${encodeURIComponent(id)}`, signal),
  items(
    id: string,
    page: number,
    status: ItemStatus | "all",
    signal?: AbortSignal,
  ) {
    const query = new URLSearchParams({ page: String(page), size: "20" });

    if (status !== "all") query.set("status", status);

    return get<ResendPage<ResendItem>>(
      `${base}/${encodeURIComponent(id)}/items?${query}`,
      signal,
    );
  },
  start: (id: string) => action(id, "start"),
  retry: (id: string) => action(id, "retry-failed"),
  cancel: (id: string) => action(id, "cancel"),
};
