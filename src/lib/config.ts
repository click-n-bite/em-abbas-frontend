import type { Locale, Role } from "./types"

const RAW_API = process.env.NEXT_PUBLIC_API_URL ?? "https://ema-api.duckdns.org"

export const API_URL = RAW_API.replace(/\/+$/, "")

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? `${API_URL.replace(/^http/, "ws")}/ws`

export const SOCKJS_URL = `${API_URL}/ws`

export const DEFAULT_LOCALE: Locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE === "ar" ? "ar" : "en"

function emailList(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean)
}

const SUPERADMINS = emailList(process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS)

const ADMINS = emailList(process.env.NEXT_PUBLIC_ADMIN_EMAILS)

/**
 * The API's wire format uses `super_admin` (with underscore); the portal's
 * internal Role type keeps the existing `superadmin` (no underscore) so the
 * rest of the app, and the i18n keys, don't need to change.
 */
function normalizeWireRole(value: unknown): Role | null {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase()

	if (normalized === "super_admin" || normalized === "superadmin") return "superadmin"

	if (normalized === "admin") return "admin"

	if (normalized === "agent") return "agent"

	return null
}

/** Internal Role -> the API's wire format. */
export function toWireRole(role: Role): string {
	return role === "superadmin" ? "super_admin" : role
}

/** The API's wire format -> internal Role. Falls back to 'agent' if unrecognized. */
export function fromWireRole(value: unknown): Role {
	return normalizeWireRole(value) ?? "agent"
}

export function resolveRole(email: string, claimRole?: unknown): Role {
	const normalized = normalizeWireRole(claimRole)

	if (normalized) return normalized

	const lowerEmail = email.trim().toLowerCase()

	if (SUPERADMINS.includes(lowerEmail)) return "superadmin"

	if (ADMINS.includes(lowerEmail)) return "admin"

	return "agent"
}

export const STORAGE_KEYS = {
	token: "ema.token",
	refreshToken: "ema.refresh-token",
	agent: "ema.agent",
	locale: "ema.locale",
	theme: "ema.theme",
	readNotifications: "ema.notifications.read"
} as const
