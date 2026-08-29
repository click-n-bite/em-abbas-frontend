import { request, unwrapItem, unwrapList } from "@/lib/http"
import type { BlockCountryPayload, BlockedCountry } from "./types"

/** Country blocking on the real EMA backend (/api/admin/blocked-countries). */
export const blacklistApi = {
	async list(signal?: AbortSignal): Promise<BlockedCountry[]> {
		const payload = await request<unknown>("/api/admin/blocked-countries", { signal })

		return unwrapList<BlockedCountry>(payload, "blockedCountries")
	},

	async block(payload: BlockCountryPayload): Promise<BlockedCountry> {
		const result = await request<unknown>("/api/admin/blocked-countries", {
			method: "POST",
			body: payload
		})

		return unwrapItem<BlockedCountry>(result, "blockedCountry")
	},

	/** The real backend deletes by record id, not by country code. */
	unblock(id: string): Promise<void> {
		return request<void>(`/api/admin/blocked-countries/${id}`, { method: "DELETE" })
	}
}
