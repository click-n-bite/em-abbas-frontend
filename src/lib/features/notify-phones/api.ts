import { LOCAL, request, unwrapItem, unwrapList } from "@/lib/http"
import type { NotifyPhone, NotifyPhonePayload } from "./types"

export const notifyPhonesApi = {
	async list(signal?: AbortSignal): Promise<NotifyPhone[]> {
		const payload = await request<unknown>("/api/notify-phones", { ...LOCAL, signal })

		return unwrapList<NotifyPhone>(payload, "notifyPhones")
	},

	async add(payload: NotifyPhonePayload): Promise<NotifyPhone> {
		const result = await request<unknown>("/api/notify-phones", {
			...LOCAL,
			method: "POST",
			body: payload
		})

		return unwrapItem<NotifyPhone>(result, "notifyPhone")
	},

	remove(id: string): Promise<void> {
		return request<void>(`/api/notify-phones/${encodeURIComponent(id)}`, {
			...LOCAL,
			method: "DELETE"
		})
	}
}
