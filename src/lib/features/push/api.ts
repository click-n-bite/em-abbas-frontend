import { request, unwrapItem } from "@/lib/http";
import type {
  PushConfig,
  PushSubscriptionPayload,
  PushSubscriptionRecord,
} from "./types";

export const pushApi = {
  async config(signal?: AbortSignal): Promise<PushConfig> {
    const payload = await request<unknown>("/api/push/config", { signal });

    const data = unwrapItem<Partial<PushConfig>>(payload, "data");

    console.log("data", data);

    return {
      enabled: Boolean(data?.enabled),
      publicKey: data?.publicKey ?? null,
    };
  },

  async subscribe(
    body: PushSubscriptionPayload,
  ): Promise<PushSubscriptionRecord> {
    const payload = await request<unknown>("/api/push/subscriptions", {
      method: "POST",
      body,
    });

    const data = unwrapItem<Partial<PushSubscriptionRecord>>(payload, "data");

    return {
      id: Number(data?.id),
      enabled: data?.enabled !== false,
    };
  },

  async unsubscribe(id: number): Promise<void> {
    await request<unknown>(`/api/push/subscriptions/${id}`, {
      method: "DELETE",
    });
  },

  async test(subscriptionId: number): Promise<void> {
    await request<unknown>("/api/push/test", {
      method: "POST",
      body: { subscriptionId },
    });
  },
};
