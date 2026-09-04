/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { errorKey } from "@/lib/errors"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { AppShell } from "@/components/layout/app-shell"
import { ChatPanel } from "@/components/chat/chat-panel"
import { ConversationList, type InboxFilter } from "@/components/chat/conversation-list"
import { cn } from "@/lib/utils"
import type { Conversation, RealtimeEvent } from "@/lib/types"

const FILTERS: InboxFilter[] = ["all", "bot", "mine", "hidden"]

function sortByRecent(list: Conversation[]): Conversation[] {
	return [...list].sort((a, b) => {
		const left = a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? ""

		const right = b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? ""

		return right.localeCompare(left)
	})
}

function matchesFilter(conversation: Partial<Conversation>, filter: InboxFilter, agentId: string | null): boolean {
	if (filter === "hidden") return conversation.hidden === true

	if (conversation.hidden) return false

	if (filter === "all") return true

	if (filter === "bot") return conversation.mode === "bot"

	if (filter === "mine") return conversation.mode === "agent" && conversation.assigneeId === agentId

	return false
}

export default function ConversationsPage() {
	const router = useRouter()

	const params = useSearchParams()

	const { t } = useI18n()

	const { agent, canManageUsers } = useAuth()

	const requestedId = params.get("id")

	const requestedFilter = params.get("filter")

	const [conversations, setConversations] = useState<Conversation[]>([])

	const [filter, setFilter] = useState<InboxFilter>(
		FILTERS.includes(requestedFilter as InboxFilter) ? (requestedFilter as InboxFilter) : "all"
	)

	const [search, setSearch] = useState("")

	const [activeId, setActiveId] = useState<string | null>(requestedId)

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const inFlight = useRef(false)

	const load = useCallback(
		async (silent = false) => {
			if (inFlight.current) return

			inFlight.current = true

			if (!silent) setLoading(true)

			try {
				const list = await api.conversations(filter)

				setConversations(list)
				setFailure(null)

				const needsName = list.filter((item) => item.mode === "agent" && item.assigneeId && !item.assignee)

				if (needsName.length > 0) {
					void Promise.allSettled(needsName.map((item) => api.conversation(item.id))).then((results) => {
						results.forEach((result) => {
							if (result.status !== "fulfilled") return

							const fresh = result.value

							setConversations((current) =>
								current.map((item) => (item.id === fresh.id ? { ...item, assignee: fresh.assignee ?? null } : item))
							)
						})
					})
				}
			} catch (error) {
				setFailure(errorKey(error))
			} finally {
				inFlight.current = false
				setLoading(false)
			}
		},
		[filter]
	)

	useEffect(() => {
		void load()
	}, [load])

	useEffect(() => {
		if (filter === "hidden" && !canManageUsers) setFilter("all")

		if (filter === "mine" && canManageUsers) setFilter("all")
	}, [filter, canManageUsers])

	useEffect(() => {
		if (requestedId) setActiveId(requestedId)
	}, [requestedId])

	useEffect(() => {
		const query = new URLSearchParams()

		if (activeId) query.set("id", activeId)

		if (filter !== "all") query.set("filter", filter)

		const search = query.toString()

		router.replace(search ? `/conversations?${search}` : "/conversations", { scroll: false })
	}, [activeId, filter, router])

	const filtered = useMemo(() => {
		const needle = search.trim().toLowerCase()

		const inTab = conversations.filter((conversation) => matchesFilter(conversation, filter, agent?.id ?? null))

		if (!needle) return inTab

		return inTab.filter((conversation) => {
			const name = conversation.customerName?.toLowerCase() ?? ""

			return name.includes(needle) || conversation.phone.toLowerCase().includes(needle)
		})
	}, [conversations, search, filter, agent?.id])

	const active = useMemo(
		() => conversations.find((conversation) => conversation.id === activeId) ?? null,
		[conversations, activeId]
	)

	const [detached, setDetached] = useState<Conversation | null>(null)

	useEffect(() => {
		if (!activeId || active) {
			setDetached(null)

			return
		}

		let cancelled = false

		api
			.conversation(activeId)
			.then((conversation) => {
				if (!cancelled) setDetached(conversation)
			})
			.catch(() => {
				if (!cancelled) setDetached(null)
			})

		return () => {
			cancelled = true
		}
	}, [activeId, active])

	const selected = active ?? detached

	const onConversationChange = useCallback((next: Conversation) => {
		setConversations((current) =>
			sortByRecent(
				current.some((conversation) => conversation.id === next.id)
					? current.map((conversation) => (conversation.id === next.id ? { ...conversation, ...next } : conversation))
					: [next, ...current]
			)
		)
		setDetached((current) => (current && current.id === next.id ? { ...current, ...next } : current))
	}, [])

	const activeIdRef = useRef(activeId)

	activeIdRef.current = activeId

	const filterRef = useRef(filter)

	filterRef.current = filter

	const agentIdRef = useRef<string | null>(agent?.id ?? null)

	agentIdRef.current = agent?.id ?? null

	const onConversationDeleted = useCallback((id: string) => {
		setConversations((current) => current.filter((conversation) => conversation.id !== id))
		setDetached((current) => (current && current.id === id ? null : current))

		if (activeIdRef.current === id) setActiveId(null)
	}, [])

	const onConversationHiddenChange = useCallback((id: string, hidden: boolean) => {
		if (matchesFilter({ id, hidden }, filterRef.current, agentIdRef.current)) return

		setConversations((current) => current.filter((conversation) => conversation.id !== id))
		setDetached((current) => (current && current.id === id ? null : current))

		if (activeIdRef.current === id) setActiveId(null)
	}, [])

	const handleToggleHide = useCallback(
		async (id: string, hide: boolean) => {
			const updated = hide ? await api.hideConversation(id) : await api.unhideConversation(id)

			onConversationChange(updated)
			onConversationHiddenChange(id, updated.hidden ?? hide)
		},
		[onConversationChange, onConversationHiddenChange]
	)

	const upsert = useCallback((partial: Partial<Conversation> & { id: string }) => {
		setConversations((current) => {
			const idx = current.findIndex((conversation) => conversation.id === partial.id)

			if (idx === -1) {
				if (!matchesFilter(partial, filterRef.current, agentIdRef.current)) return current

				return sortByRecent([{ unreadCount: 0, ...partial } as Conversation, ...current])
			}

			const existing = current[idx]

			const merged: Conversation = { ...existing, ...partial }

			if (
				partial.lastMessageDirection === "inbound" &&
				partial.id !== activeIdRef.current &&
				partial.unreadCount === undefined
			) {
				merged.unreadCount = (existing.unreadCount ?? 0) + 1
			}

			const next = [...current]

			next[idx] = merged

			return sortByRecent(next)
		})

		setDetached((current) => (current && current.id === partial.id ? { ...current, ...partial } : current))
	}, [])

	const onRealtimeEvent = useCallback(
		(payload: unknown) => {
			const event = payload as RealtimeEvent | null

			if (!event || typeof event.event !== "string") return

			switch (event.event) {
				case "conversation.upserted": {
					const { event: _ignored, ...rest } = event

					upsert(rest as Partial<Conversation> & { id: string })

					break
				}

				case "handoff.requested": {
					const conversationId = event.conversationId as string | undefined

					if (!conversationId) break

					upsert({
						id: conversationId,
						mode: (event.mode as Conversation["mode"]) ?? "bot",
						preview: (event.preview as string | null | undefined) ?? undefined,
						handoffRequested: true
					})

					break
				}

				case "conversation.assigned": {
					const conversationId = event.conversationId as string | undefined

					if (!conversationId) break

					const nextAssigneeId = (event.assigneeId as string | null | undefined) ?? null

					upsert({
						id: conversationId,
						mode: (event.mode as Conversation["mode"]) ?? "agent",
						assigneeId: nextAssigneeId,
						assignee:
							nextAssigneeId && agent && nextAssigneeId === agent.id
								? { id: agent.id, name: agent.name, email: agent.email }
								: null
					})

					if (nextAssigneeId && nextAssigneeId !== agent?.id) {
						void api
							.conversation(conversationId)
							.then((fresh) => upsert({ id: conversationId, assignee: fresh.assignee ?? null }))
							.catch(() => undefined)
					}

					break
				}

				case "conversation.read": {
					const conversationId = event.conversationId as string | undefined

					if (!conversationId) break

					upsert({
						id: conversationId,
						unreadCount: (event.unreadCount as number | undefined) ?? 0,
						lastReadAt: (event.lastReadAt as string | undefined) ?? null
					})

					break
				}

				default:
					break
			}
		},
		[upsert, agent]
	)

	const socketTopics = useMemo(() => {
		if (!agent?.id) return []

		return ["/topic/inbox", `/topic/agent/${agent.id}`]
	}, [agent?.id])

	useRealtime({ topics: socketTopics, onEvent: onRealtimeEvent, enabled: Boolean(agent) })

	return (
		<AppShell
			flush
			title={t("inbox.title")}
			subtitle={failure ? t(failure) : t("inbox.selectHint")}
			actions={
				<button
					type='button'
					onClick={() => void load(true)}
					className='btn-secondary px-3 py-2'
					aria-label={t("common.refresh")}
					title={t("common.refresh")}>
					<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden='true' />
				</button>
			}>
			<div className='grid h-full min-h-0 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]'>
				<div className={cn("card min-h-0 overflow-hidden", selected ? "hidden lg:block" : "block")}>
					<ConversationList
						conversations={filtered}
						activeId={activeId}
						filter={filter}
						search={search}
						loading={loading}
						onSelect={setActiveId}
						onFilterChange={(next) => {
							setFilter(next)
							setLoading(true)
						}}
						onSearchChange={setSearch}
						onToggleHide={canManageUsers ? handleToggleHide : undefined}
					/>
				</div>

				<div
					className={cn(
						"min-h-0 overflow-hidden transition-transform duration-300 ease-out",
						"fixed inset-0 z-40 bg-white dark:bg-ink-900",
						"lg:static lg:z-auto lg:translate-x-0 lg:rounded-2xl lg:border lg:border-ink-200 lg:bg-white lg:shadow-sm lg:transition-none lg:dark:border-ink-700 lg:dark:bg-ink-800",
						selected
							? "translate-x-0"
							: "pointer-events-none translate-x-full lg:pointer-events-auto rtl:-translate-x-full"
					)}>
					<ChatPanel
						conversation={selected}
						onConversationChange={onConversationChange}
						onBack={() => setActiveId(null)}
						onToggleHide={handleToggleHide}
					/>
				</div>
			</div>
		</AppShell>
	)
}
