import type { Role } from "@/lib/features/auth/types"

export interface PortalUser {
	id: string
	username: string
	displayName: string
	role: Role
	isActive: boolean
	createdAt: string
	updatedAt: string
}

export interface UserPayload {
	username: string
	displayName: string
	role: Role
	isActive: boolean
	/** Required on create; optional on update (send only when changing it). */
	password?: string
}
