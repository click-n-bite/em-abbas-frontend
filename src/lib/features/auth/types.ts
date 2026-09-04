export type Role = "superadmin" | "admin" | "agent"

export interface SessionAgent {
	id: string
	email: string
	name: string
	role: Role
	expiresAt: number
}

export interface LoginResponse {
	accessToken: string
	refreshToken: string
	expiresInSeconds: number
	tokenType: string
}

export interface AccessTokenClaims {
	sub: string
	uid: number
	role: string
	tv: number
	iat: number
	exp: number
}
