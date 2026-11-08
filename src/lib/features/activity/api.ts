import { request } from "@/lib/http";
import { appendSort } from "@/lib/sorting";
import type {
  ActivityListParams,
  ConversationActivityResponse,
} from "./types";

export const activityApi = {
  async get(
    conversationId: string,
    params: ActivityListParams = {},
    signal?: AbortSignal,
  ): Promise<ConversationActivityResponse> {
    const search = new URLSearchParams();

    appendSort(search, params);

    const query = search.toString();

    return request<ConversationActivityResponse>(
      `/conversations/${conversationId}/activity${query ? `?${query}` : ""}`,
      { signal },
    );
  },
};
