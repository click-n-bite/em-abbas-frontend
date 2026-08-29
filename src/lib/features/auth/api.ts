import { request, unwrapItem } from "@/lib/http"
import type { LoginResponse } from "./types"

export const authApi = {
	/** `username` matches the real EMA API's login contract (not an e-mail). */
	async login(username: string, password: string): Promise<LoginResponse> {
		const payload = await request<unknown>("/api/auth/login", {
			method: "POST",
			body: { username, password },
			auth: false
		})

		return unwrapItem<LoginResponse>(payload, "data")
	}
}
