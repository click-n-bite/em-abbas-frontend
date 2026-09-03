import { request, unwrapItem, unwrapList } from "@/lib/http"
import type { BlockedNumbersStatusFilter, BlockedWhatsappNumber, BlockNumberPayload } from "./types"

/**
 * WhatsApp number blocking on the real EMA backend
 * (/api/admin/blocked-whatsapp-numbers). SUPER_ADMIN / ADMIN only — AGENT
 * gets 403. Distinct from country blocking (see the `blacklist` feature) and
 * from the read-only `blocked` badge shown on an open chat.
 */
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

	/** 201 the first time a phone is blocked, 200 if the row already existed (re-block / retry Meta). */
	async block(payload: BlockNumberPayload): Promise<BlockedWhatsappNumber> {
		const result = await request<unknown>("/api/admin/blocked-whatsapp-numbers", {
			method: "POST",
			body: payload
		})

		return unwrapItem<BlockedWhatsappNumber>(result, "blockedWhatsappNumber")
	},

	/** Row is kept for history — localStatus becomes "unblocked", whatsappStatus resets to "pending". */
	async unblock(id: string): Promise<BlockedWhatsappNumber> {
		const result = await request<unknown>(`/api/admin/blocked-whatsapp-numbers/${id}/unblock`, {
			method: "POST"
		})

		return unwrapItem<BlockedWhatsappNumber>(result, "blockedWhatsappNumber")
	}
}
