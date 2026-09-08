import { request } from "@/lib/http"
import type { ConversationActivityResponse } from "./types"

export const activityApi = {
	async get(conversationId: string, signal?: AbortSignal): Promise<ConversationActivityResponse> {
		return request<ConversationActivityResponse>(`/conversations/${conversationId}/activity`, { signal })
	}
}
