import { request, unwrapItem, unwrapList } from "@/lib/http"
import type { BlockedNumbersStatusFilter, BlockedWhatsappNumber, BlockNumberPayload } from "./types"

export const blockedNumbersApi = {
	async list(
		status: BlockedNumbersStatusFilter = "blocked",
		phone?: string,
		signal?: AbortSignal
	): Promise<BlockedWhatsappNumber[]> {
		const params = new URLSearchParams()

		if (status) params.set("status", status)

		if (phone) params.set("phone", phone)

		const query = params.toString() ? `?${params.toString()}` : ""

		const payload = await request<unknown>(`/api/admin/blocked-whatsapp-numbers${query}`, { signal })

		return unwrapList<BlockedWhatsappNumber>(payload, "blockedWhatsappNumbers")
	},

	async block(payload: BlockNumberPayload): Promise<BlockedWhatsappNumber> {
		const result = await request<unknown>("/api/admin/blocked-whatsapp-numbers", {
			method: "POST",
			body: payload
		})

		return unwrapItem<BlockedWhatsappNumber>(result, "blockedWhatsappNumber")
	},

	async unblock(id: string): Promise<BlockedWhatsappNumber> {
		const result = await request<unknown>(`/api/admin/blocked-whatsapp-numbers/${id}/unblock`, {
			method: "POST"
		})

		return unwrapItem<BlockedWhatsappNumber>(result, "blockedWhatsappNumber")
	}
}
