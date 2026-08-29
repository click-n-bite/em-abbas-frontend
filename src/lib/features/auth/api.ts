import { request, unwrapItem } from "@/lib/http"
import type { LoginResponse } from "./types"

export const authApi = {
	async login(username: string, password: string): Promise<LoginResponse> {
		const payload = await request<unknown>("/api/auth/login", {
			method: "POST",
			body: { username, password },
			auth: false
		})

		return unwrapItem<LoginResponse>(payload, "data")
	},
	async refresh(refreshToken: string): Promise<LoginResponse> {
	  const payload = await request<unknown>("/api/auth/refresh", {
		method: "POST",
		body: { refreshToken },
		auth: false
	  })
	  return unwrapItem<LoginResponse>(payload, "data")
	}
}
