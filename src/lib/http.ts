import { API_URL, STORAGE_KEYS } from "./config"

export class ApiError extends Error {
	status: number
	code: string

	constructor(status: number, code: string, message: string) {
		super(message)
		this.name = "ApiError"
		this.status = status
		this.code = code
	}
}

export function readToken(): string | null {
	if (typeof window === "undefined") return null

	return window.localStorage.getItem(STORAGE_KEYS.token)
}

export function readRefreshToken(): string | null {
	if (typeof window === "undefined") return null

	return window.localStorage.getItem(STORAGE_KEYS.refreshToken)
}

export function clearSession(): void {
	if (typeof window === "undefined") return

	window.localStorage.removeItem(STORAGE_KEYS.token)
	window.localStorage.removeItem(STORAGE_KEYS.refreshToken)
	window.localStorage.removeItem(STORAGE_KEYS.agent)
}

export interface RequestOptions {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
	body?: unknown
	auth?: boolean
	baseUrl?: string
	signal?: AbortSignal
}

export const LOCAL = { baseUrl: "", auth: true } as const

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const { method = "GET", body, auth = true, baseUrl = API_URL, signal } = options

	const headers: Record<string, string> = { Accept: "application/json" }

	if (body !== undefined) headers["Content-Type"] = "application/json"

	if (auth) {
		const token = readToken()

		if (token) headers.Authorization = `Bearer ${token}`
	}

	let response: Response

	try {
		response = await fetch(`${baseUrl}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			cache: "no-store",
			signal
		})
	} catch (error) {
		if ((error as Error)?.name === "AbortError") throw error

		throw new ApiError(0, "NETWORK_ERROR", "errors.network")
	}

	if (response.status === 204) return undefined as T

	const raw = await response.text()

	let payload: unknown = null

	if (raw) {
		try {
			payload = JSON.parse(raw)
		} catch {
			payload = { message: raw }
		}
	}

	if (!response.ok) {
		const record = (payload ?? {}) as Record<string, unknown>

		const code = record.code ?? record.error ?? `HTTP_${response.status}`

		const message = record.message ?? response.statusText

		if (response.status === 401 && auth) clearSession()

		throw new ApiError(response.status, String(code), String(message))
	}

	return payload as T
}

/**
 * The live EMA API wraps most payloads in an envelope, e.g. `{ data: [...] }`
 * or `{ data: { users: [...] } }`. This tries every shape we've seen rather
 * than assuming one, so it keeps working even if the wrapping changes.
 */
export function unwrapList<T>(payload: unknown, key: string): T[] {
	if (Array.isArray(payload)) return payload as T[]

	if (payload && typeof payload === "object") {
		const record = payload as Record<string, unknown>

		if (Array.isArray(record[key])) return record[key] as T[]

		if (Array.isArray(record.data)) return record.data as T[]

		if (record.data && typeof record.data === "object") {
			const nested = record.data as Record<string, unknown>

			if (Array.isArray(nested[key])) return nested[key] as T[]
		}
	}

	return []
}

export function unwrapItem<T>(payload: unknown, key: string): T {
	if (payload && typeof payload === "object" && !Array.isArray(payload)) {
		const record = payload as Record<string, unknown>

		if (record[key] && typeof record[key] === "object") return record[key] as T

		if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
			const nested = record.data as Record<string, unknown>

			if (nested[key] && typeof nested[key] === "object") return nested[key] as T

			return nested as T
		}
	}

	return payload as T
}

export function decodeJwt(token: string): Record<string, unknown> | null {
	try {
		const part = token.split(".")[1]

		if (!part) return null

		const base64 = part.replace(/-/g, "+").replace(/_/g, "/")

		const json = decodeURIComponent(
			atob(base64)
				.split("")
				.map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
				.join("")
		)

		return JSON.parse(json) as Record<string, unknown>
	} catch {
		return null
	}
}
