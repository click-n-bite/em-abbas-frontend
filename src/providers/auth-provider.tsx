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

const REFRESH_BUFFER_MS = 60_000
const MIN_SCHEDULE_MS = 3_000

function isExpired(session: SessionAgent | null): boolean {
	return Boolean(session?.expiresAt) && Date.now() >= (session?.expiresAt ?? 0)
}

function sessionFromToken(accessToken: string, base: SessionAgent | null): SessionAgent {
	const claims = decodeJwt(accessToken) as Partial<AccessTokenClaims> | null

	const username = claims?.sub ?? base?.email ?? base?.name ?? ""

	return {
		id: claims?.uid !== undefined ? String(claims.uid) : (base?.id ?? username),
		email: base?.email ?? username,
		name: base?.name ?? username,
		role: base?.role ?? resolveRole(username, claims?.role),
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
