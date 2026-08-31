"use client"

import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { api, clearSession, decodeJwt, refreshAccessToken } from "@/lib/api"
import { resolveRole, STORAGE_KEYS } from "@/lib/config"
import type { AccessTokenClaims, Role, SessionAgent } from "@/lib/types"

interface AuthContextValue {
	agent: SessionAgent | null
	token: string | null
	ready: boolean
	role: Role
	canManageUsers: boolean
	signIn: (username: string, password: string) => Promise<void>
	signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Refresh a bit before the access token actually dies (it lives 15 minutes),
// so the person renews silently in the background and never actually hits a
// 401. If the network is briefly unreachable, we still have this much of a
// buffer to retry before the token truly expires.
const REFRESH_BUFFER_MS = 60_000
const MIN_SCHEDULE_MS = 3_000

function isExpired(session: SessionAgent | null): boolean {
	return Boolean(session?.expiresAt) && Date.now() >= (session?.expiresAt ?? 0)
}

/** Build/refresh a SessionAgent from a JWT, keeping whatever identity fields
 *  the caller already had (username, resolved role, etc.) when the fresh
 *  token's claims don't carry them. */
function sessionFromToken(accessToken: string, base: SessionAgent | null): SessionAgent {
	const claims = decodeJwt(accessToken) as Partial<AccessTokenClaims> | null

	const username = claims?.sub ?? base?.email ?? base?.name ?? ""

	return {
		id: claims?.uid !== undefined ? String(claims.uid) : (base?.id ?? username),
		email: base?.email ?? username,
		name: base?.name ?? username,
		role: base?.role ?? resolveRole(username, claims?.role),
		// Standard JWT `exp` is seconds since epoch; fall back to a 15 minute
		// window (the documented access-token lifetime) if it's missing.
		expiresAt: claims?.exp ? claims.exp * 1000 : Date.now() + 15 * 60 * 1000
	}
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const router = useRouter()

	const [agent, setAgent] = useState<SessionAgent | null>(null)

	const [token, setToken] = useState<string | null>(null)

	const [ready, setReady] = useState(false)

	const refreshTimer = useRef<number | null>(null)

	const loggingOut = useRef(false)

	const logout = useCallback(() => {
		if (loggingOut.current) return

		loggingOut.current = true

		clearSession()
		setToken(null)
		setAgent(null)
		// router.replace is a client-side navigation — no full page reload,
		// so this fires the instant a refresh fails, not on the next click.
		router.replace("/login")
	}, [router])

	const applySession = useCallback((accessToken: string, base: SessionAgent | null) => {
		const session = sessionFromToken(accessToken, base)

		window.localStorage.setItem(STORAGE_KEYS.token, accessToken)
		window.localStorage.setItem(STORAGE_KEYS.agent, JSON.stringify(session))

		loggingOut.current = false
		setToken(accessToken)
		setAgent(session)

		return session
	}, [])

	// React to refreshes/expirations triggered from inside http.ts (e.g. a
	// request that hit a 401 mid-flight and refreshed reactively).
	useEffect(() => {
		const onExpired = () => logout()

		const onRefreshed = (event: Event) => {
			const accessToken = (event as CustomEvent<string>).detail

			if (accessToken) applySession(accessToken, agent)
		}

		window.addEventListener("ema:session-expired", onExpired)
		window.addEventListener("ema:token-refreshed", onRefreshed)

		return () => {
			window.removeEventListener("ema:session-expired", onExpired)
			window.removeEventListener("ema:token-refreshed", onRefreshed)
		}
	}, [agent, applySession, logout])

	// Initial load: if the stored access token already expired, try a
	// silent refresh before giving up (the refresh token likely still has
	// plenty of life left even after e.g. the laptop was asleep).
	useEffect(() => {
		let cancelled = false

		async function bootstrap() {
			try {
				const storedToken = window.localStorage.getItem(STORAGE_KEYS.token)

				const storedAgent = window.localStorage.getItem(STORAGE_KEYS.agent)

				const parsedAgent = storedAgent ? (JSON.parse(storedAgent) as SessionAgent) : null

				if (!storedToken || !parsedAgent) {
					if (storedToken || storedAgent) clearSession()

					return
				}

				if (!isExpired(parsedAgent)) {
					setToken(storedToken)
					setAgent(parsedAgent)

					return
				}

				const freshToken = await refreshAccessToken()

				if (cancelled) return

				if (freshToken) {
					applySession(freshToken, parsedAgent)
				} else {
					clearSession()
				}
			} catch {
				clearSession()
			} finally {
				if (!cancelled) setReady(true)
			}
		}

		void bootstrap()

		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Proactive background refresh: schedule the next silent refresh a
	// minute before the current access token expires. If it succeeds, the
	// resulting `agent` update reschedules the next one automatically. If
	// the refresh token itself is dead, log out immediately — no waiting
	// for the person to hit a 401 on some future click.
	useEffect(() => {
		if (refreshTimer.current) {
			window.clearTimeout(refreshTimer.current)
			refreshTimer.current = null
		}

		if (!agent?.expiresAt) return

		const delay = Math.max(agent.expiresAt - Date.now() - REFRESH_BUFFER_MS, MIN_SCHEDULE_MS)

		refreshTimer.current = window.setTimeout(async () => {
			const freshToken = await refreshAccessToken()

			if (freshToken) {
				applySession(freshToken, agent)
			} else {
				logout()
			}
		}, delay)

		return () => {
			if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
		}
	}, [agent, applySession, logout])

	const signIn = useCallback(
		async (username: string, password: string) => {
			const result = await api.login(username, password)

			const claims = decodeJwt(result.accessToken) as Partial<AccessTokenClaims> | null

			const resolvedUsername = claims?.sub ?? username

			const session: SessionAgent = {
				id: claims?.uid !== undefined ? String(claims.uid) : resolvedUsername,
				email: resolvedUsername,
				name: resolvedUsername,
				role: resolveRole(resolvedUsername, claims?.role),
				expiresAt: claims?.exp ? claims.exp * 1000 : Date.now() + result.expiresInSeconds * 1000
			}

			window.localStorage.setItem(STORAGE_KEYS.token, result.accessToken)
			window.localStorage.setItem(STORAGE_KEYS.refreshToken, result.refreshToken)
			window.localStorage.setItem(STORAGE_KEYS.agent, JSON.stringify(session))
			loggingOut.current = false
			setToken(result.accessToken)
			setAgent(session)
		},
		[]
	)

	const signOut = useCallback(() => {
		logout()
	}, [logout])

	const value = useMemo<AuthContextValue>(() => {
		const role = agent?.role ?? "agent"

		return {
			agent,
			token,
			ready,
			role,
			canManageUsers: role === "superadmin" || role === "admin",
			signIn,
			signOut
		}
	}, [agent, token, ready, signIn, signOut])

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext)

	if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")

	return ctx
}
