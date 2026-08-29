import { request, unwrapList } from "@/lib/http"
import type { AppNotification } from "./types"

export const notificationsApi = {
	async list(unreadOnly = false, signal?: AbortSignal): Promise<AppNotification[]> {
		const payload = await request<unknown>(`/api/notifications?unread=${unreadOnly}`, { signal })

		return unwrapList<AppNotification>(payload, "notifications")
	},

	markRead(id: string): Promise<void> {
		return request<void>(`/api/notifications/${id}/read`, { method: "POST" })
	}
}
