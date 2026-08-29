"use client"

import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { api, clearSession, decodeJwt } from "@/lib/api"
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



function isExpired(session: SessionAgent | null): boolean {
	return Boolean(session?.expiresAt) && Date.now() >= (session?.expiresAt ?? 0)
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const router = useRouter()

	const [agent, setAgent] = useState<SessionAgent | null>(null)

	const [token, setToken] = useState<string | null>(null)

	const [ready, setReady] = useState(false)

	useEffect(() => {
		const onExpired = () => { clearSession(); setToken(null); setAgent(null); router.replace("/login") }
		const onRefreshed = (e: Event) => setToken((e as CustomEvent).detail)
		window.addEventListener("ema:session-expired", onExpired)
		window.addEventListener("ema:token-refreshed", onRefreshed)
		return () => {
			window.removeEventListener("ema:session-expired", onExpired)
			window.removeEventListener("ema:token-refreshed", onRefreshed)
		}
	}, [router])

	useEffect(() => {
		try {
			const storedToken = window.localStorage.getItem(STORAGE_KEYS.token)

			const storedAgent = window.localStorage.getItem(STORAGE_KEYS.agent)

			const parsedAgent = storedAgent ? (JSON.parse(storedAgent) as SessionAgent) : null

			if (storedToken && parsedAgent && !isExpired(parsedAgent)) {
				setToken(storedToken)
				setAgent(parsedAgent)
			} else if (storedToken || storedAgent) {
				clearSession()
			}
		} catch {
			clearSession()
		} finally {
			setReady(true)
		}
	}, [])

	const signIn = useCallback(async (username: string, password: string) => {
		const result = await api.login(username, password)

		const claims = decodeJwt(result.accessToken) as Partial<AccessTokenClaims> | null

		const resolvedUsername = claims?.sub ?? username

		const session: SessionAgent = {
			id: claims?.uid !== undefined ? String(claims.uid) : resolvedUsername,
			email: resolvedUsername,
			name: resolvedUsername,
			role: resolveRole(resolvedUsername, claims?.role),
			expiresAt: Date.now() + result.expiresInSeconds * 1000
		}

		window.localStorage.setItem(STORAGE_KEYS.token, result.accessToken)
		window.localStorage.setItem(STORAGE_KEYS.refreshToken, result.refreshToken)
		window.localStorage.setItem(STORAGE_KEYS.agent, JSON.stringify(session))
		setToken(result.accessToken)
		setAgent(session)
	}, [])

	const signOut = useCallback(() => {
		clearSession()
		setToken(null)
		setAgent(null)
		router.replace("/login")
	}, [router])

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
