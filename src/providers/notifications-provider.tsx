"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { api } from "@/lib/api"
import { errorKey } from "@/lib/errors"
import { usePoll } from "@/hooks/use-poll"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "./auth-provider"
import type { AppNotification } from "@/lib/types"

interface NotificationsValue {
	items: AppNotification[]
	unread: number
	loading: boolean
	errorKey: string | null
	refresh: () => Promise<void>
	markRead: (id: string) => Promise<void>
	markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }): JSX.Element {
	const { token, agent } = useAuth()

	const [items, setItems] = useState<AppNotification[]>([])

	const [loading, setLoading] = useState<boolean>(true)

	const [failure, setFailure] = useState<string | null>(null)

	const inFlight = useRef<boolean>(false)

	const refresh = useCallback(async (): Promise<void> => {
		if (!token || inFlight.current) return

		inFlight.current = true

		try {
			const response = await api.notifications(false)

			setItems(response)
			setFailure(null)
		} catch (error) {
			setFailure(errorKey(error))
		} finally {
			inFlight.current = false
			setLoading(false)
		}
	}, [token])

	useEffect(() => {
		if (!token) {
			setItems([])
			setLoading(false)

			return
		}

		setLoading(true)
		void refresh()
	}, [token, refresh])

	usePoll(() => void refresh(), 30000, Boolean(token))

	const topics = useMemo(() => (agent ? ["/topic/inbox", `/topic/agent/${agent.id}`] : []), [agent])

	useRealtime({
		topics,
		enabled: Boolean(token && agent),
		onEvent: (raw) => {
			const payload = raw as Record<string, unknown> | null

			if (payload?.event === "handoff.requested" || payload?.event === "conversation.assigned") {
				void refresh()
			}
		}
	})

	const markRead = useCallback(
		async (id: string): Promise<void> => {
			setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))

			try {
				await api.markNotificationRead(id)
			} catch {
				void refresh()
			}
		},
		[refresh]
	)

	const markAllRead = useCallback(async (): Promise<void> => {
		const unreadIds = items.filter((item) => !item.read).map((item) => item.id)

		if (unreadIds.length === 0) return

		setItems((current) => current.map((item) => ({ ...item, read: true })))
		await Promise.allSettled(unreadIds.map((id) => api.markNotificationRead(id)))
		void refresh()
	}, [items, refresh])

	const value = useMemo<NotificationsValue>(
		() => ({
			items,
			unread: items.filter((item) => !item.read).length,
			loading,
			errorKey: failure,
			refresh,
			markRead,
			markAllRead
		}),
		[items, loading, failure, refresh, markRead, markAllRead]
	)

	return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsValue {
	const ctx = useContext(NotificationsContext)

	if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>")

	return ctx
}
