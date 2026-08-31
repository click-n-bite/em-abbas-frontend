import { request, unwrapItem, unwrapList } from "@/lib/http"
import type { CreateNotifyPhonePayload, NotifyPhone, UpdateNotifyPhonePayload } from "./types"

/**
 * Notify WhatsApp numbers on the real EMA backend
 * (/api/admin/notify-whatsapp-numbers). Envelope shape: { success, message, data }.
 */
export const notifyPhonesApi = {
	async list(signal?: AbortSignal): Promise<NotifyPhone[]> {
		const payload = await request<unknown>("/api/admin/notify-whatsapp-numbers", { signal })

		return unwrapList<NotifyPhone>(payload, "data")
	},

	async add(payload: CreateNotifyPhonePayload): Promise<NotifyPhone> {
		const result = await request<unknown>("/api/admin/notify-whatsapp-numbers", {
			method: "POST",
			body: { notificationsEnabled: true, ...payload }
		})

		return unwrapItem<NotifyPhone>(result, "data")
	},

	async update(id: number, payload: UpdateNotifyPhonePayload): Promise<NotifyPhone> {
		const result = await request<unknown>(`/api/admin/notify-whatsapp-numbers/${id}`, {
			method: "PATCH",
			body: payload
		})

		return unwrapItem<NotifyPhone>(result, "data")
	},

	remove(id: number): Promise<void> {
		return request<void>(`/api/admin/notify-whatsapp-numbers/${id}`, { method: "DELETE" })
	}
}
