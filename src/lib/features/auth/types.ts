export type Role = "superadmin" | "admin" | "agent"

export interface SessionAgent {
	id: string
	email: string
	name: string
	role: Role
	expiresAt: number
}

/** The confirmed, actual shape of POST /api/auth/login's `data` — no `user` object. */
export interface LoginResponse {
	accessToken: string
	refreshToken: string
	expiresInSeconds: number
	tokenType: string
}

/** Claims found in the access token (HS512 JWT): sub=username, uid=numeric id, role=UPPER_SNAKE. */
export interface AccessTokenClaims {
	sub: string
	uid: number
	role: string
	tv: number
	iat: number
	exp: number
}
