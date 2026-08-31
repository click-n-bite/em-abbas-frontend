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

let refreshing: Promise<string | null> | null = null

// If the refresh call itself hangs (flaky network, dead connection), don't
// let the caller wait forever — treat it as a failed refresh so the session
// is torn down and the person is sent back to /login right away.
const REFRESH_TIMEOUT_MS = 8000

async function tryRefresh(): Promise<string | null> {
	const rt = readRefreshToken()

	if (!rt) return null

	const controller = new AbortController()
	const timeout = window.setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)

	try {
		const res = await fetch(`${API_URL}/api/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: rt }),
			signal: controller.signal
		})

		if (!res.ok) return null

		const data = await res.json()
		const { accessToken, refreshToken } = data?.data ?? data

		if (!accessToken) return null

		window.localStorage.setItem(STORAGE_KEYS.token, accessToken)
		if (refreshToken) window.localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken)
		window.dispatchEvent(new CustomEvent("ema:token-refreshed", { detail: accessToken }))

		return accessToken
	} catch {
		// Network error, or the timeout above aborted it — either way, no
		// usable token came back.
		return null
	} finally {
		window.clearTimeout(timeout)
	}
}

export async function refreshAccessToken(): Promise<string | null> {
	refreshing ??= tryRefresh().finally(() => {
		refreshing = null
	})

	return refreshing
}

async function authorizedFetch(path: string, init: RequestInit, allowRefresh = true): Promise<Response> {
	const headers = new Headers(init.headers)

	const token = readToken()

	if (token) headers.set("Authorization", `Bearer ${token}`)

	let response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" })

	if (response.status === 401 && allowRefresh && !path.startsWith("/api/auth/refresh")) {
		refreshing ??= tryRefresh().finally(() => {
			refreshing = null
		})

		const newToken = await refreshing

		if (newToken) {
			headers.set("Authorization", `Bearer ${newToken}`)
			response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" })
		} else {
			clearSession()
			window.dispatchEvent(new Event("ema:session-expired"))
		}
	}

	return response
}

export async function uploadFile<T>(path: string, file: File, signal?: AbortSignal): Promise<T> {
	const form = new FormData()
	form.append("file", file)

	let response: Response

	try {
		response = await authorizedFetch(path, { method: "POST", body: form, signal })
	} catch (error) {
		if ((error as Error)?.name === "AbortError") throw error

		throw new ApiError(0, "NETWORK_ERROR", "errors.network")
	}

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

		throw new ApiError(response.status, String(code), String(message))
	}

	return unwrapItem<T>(payload, "data")
}

export async function fetchAuthorizedBlob(path: string, signal?: AbortSignal): Promise<Blob> {
	let response: Response

	try {
		response = await authorizedFetch(path, { method: "GET", signal })
	} catch (error) {
		if ((error as Error)?.name === "AbortError") throw error

		throw new ApiError(0, "NETWORK_ERROR", "errors.network")
	}

	if (!response.ok) throw new ApiError(response.status, "MEDIA_FETCH_FAILED", "errors.generic")

	return response.blob()
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const { method = "GET", body, auth = true, baseUrl = API_URL, signal } = options

	const headers: Record<string, string> = { Accept: "application/json" }

	if (body !== undefined) headers["Content-Type"] = "application/json"

	if (auth) {
		const token = readToken()

		if (token) headers.Authorization = `Bearer ${token}`
	}

	const doFetch = () =>
		fetch(`${baseUrl}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			cache: "no-store",
			signal
		})

	let response: Response

	try {
		response = await doFetch()
	} catch (error) {
		if ((error as Error)?.name === "AbortError") throw error

		throw new ApiError(0, "NETWORK_ERROR", "errors.network")
	}


	if (response.status === 401 && auth && !path.startsWith("/api/auth/refresh")) {
		refreshing ??= tryRefresh().finally(() => {
			refreshing = null
		})

		const newToken = await refreshing

		if (newToken) {
			headers.Authorization = `Bearer ${newToken}`

			try {
				response = await doFetch()
			} catch (error) {
				if ((error as Error)?.name === "AbortError") throw error

				throw new ApiError(0, "NETWORK_ERROR", "errors.network")
			}
		} else {
			clearSession()
			window.dispatchEvent(new Event("ema:session-expired"))
			throw new ApiError(401, "SESSION_EXPIRED", "errors.unauthorized")
		}
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

		if (response.status === 401 && auth) {
			clearSession()
			window.dispatchEvent(new Event("ema:session-expired"))
		}

		throw new ApiError(response.status, String(code), String(message))
	}

	return payload as T
}

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