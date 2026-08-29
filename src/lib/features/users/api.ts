import { request, unwrapItem, unwrapList } from "@/lib/http"
import { fromWireRole, toWireRole } from "@/lib/config"
import type { PortalUser, UserPayload } from "./types"

function toWirePayload(payload: Partial<UserPayload>): Record<string, unknown> {
	const { role, ...rest } = payload

	return role ? { ...rest, role: toWireRole(role) } : rest
}

function normalizeUser(user: PortalUser): PortalUser {
	return { ...user, role: fromWireRole(user.role) }
}

/** Portal user management on the real EMA backend (/api/admin/users). */
export const usersApi = {
	async list(signal?: AbortSignal): Promise<PortalUser[]> {
		const payload = await request<unknown>("/api/admin/users", { signal })

		return unwrapList<PortalUser>(payload, "users").map(normalizeUser)
	},

	async create(payload: UserPayload): Promise<PortalUser> {
		const result = await request<unknown>("/api/admin/users", {
			method: "POST",
			body: toWirePayload(payload)
		})

		return normalizeUser(unwrapItem<PortalUser>(result, "user"))
	},

	async update(id: string, payload: Partial<UserPayload>): Promise<PortalUser> {
		const result = await request<unknown>(`/api/admin/users/${id}`, {
			method: "PATCH",
			body: toWirePayload(payload)
		})

		return normalizeUser(unwrapItem<PortalUser>(result, "user"))
	},

	remove(id: string): Promise<void> {
		return request<void>(`/api/admin/users/${id}`, { method: "DELETE" })
	}
}
