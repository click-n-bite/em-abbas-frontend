/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { adminApi, api } from "@/lib/api"
import { errorKey } from "@/lib/errors"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { AppShell } from "@/components/layout/app-shell"
import { ChatPanel } from "@/components/chat/chat-panel"
import { ConversationList, type InboxFilter } from "@/components/chat/conversation-list"
import { cn } from "@/lib/utils"
import type { BlockedWhatsappNumber, Conversation, RealtimeEvent } from "@/lib/types"
import type { PortalUser } from "@/lib/features/users/types"

const FILTERS: InboxFilter[] = ["all", "bot", "agent", "mine", "hidden"]

function sortByRecent(list: Conversation[]): Conversation[] {
	return [...list].sort((a, b) => {
		const left = a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? ""

		const right = b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? ""

		return right.localeCompare(left)
	})
}

// The bulk "/conversations" list endpoint doesn't reliably compute live block
// status (only the single-conversation "/conversations/:id" endpoint does),
// so the list can come back saying a number is unblocked when it's actually
// blocked. Two-tier fix:
//  1. When we can read the admin blocked-numbers registry, it's authoritative
//     — trust it completely for every conversation's phone number.
//  2. Otherwise (no permission to read that registry), never let a plain list
//     refresh downgrade a conversation we've already confirmed is blocked
//     (via opening it or via the dedicated realtime "conversation.blocked"
//     event) back to "unblocked" — only an explicit block/unblock action or
//     event is allowed to change that.
function reconcileBlocked(
	list: Conversation[],
	previous: Conversation[],
	blockedByPhone: Map<string, BlockedWhatsappNumber> | null
): Conversation[] {
	const previousById = new Map(previous.map((conversation) => [conversation.id, conversation]))

	return list.map((conversation) => {
		if (blockedByPhone) {
			const entry = blockedByPhone.get(conversation.phone)

			return entry
				? { ...conversation, blocked: true, whatsappStatus: entry.whatsappStatus }
				: { ...conversation, blocked: false }
		}

		const prior = previousById.get(conversation.id)

		if (prior?.blocked && !conversation.blocked) {
			return { ...conversation, blocked: true, whatsappStatus: prior.whatsappStatus ?? conversation.whatsappStatus }
		}

		return conversation
	})
}

function matchesFilter(conversation: Partial<Conversation>, filter: InboxFilter, agentId: string | null): boolean {
	if (filter === "hidden") return conversation.hidden === true

	if (conversation.hidden) return false

	if (filter === "all") return true

	if (filter === "bot") return conversation.mode === "bot"

	if (filter === "agent") return conversation.mode === "agent"

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

	// --- Admin/superadmin-only agent filter -----------------------------
	const [agents, setAgents] = useState<PortalUser[]>([])

	const [agentFilter, setAgentFilter] = useState<string>("all")

	useEffect(() => {
		if (!canManageUsers) return

		let cancelled = false

		adminApi
			.listUsers()
			.then((list) => {
				if (!cancelled) setAgents(list)
			})
			.catch(() => {
				if (!cancelled) setAgents([])
			})

		return () => {
			cancelled = true
		}
	}, [canManageUsers])

	useEffect(() => {
		if (!canManageUsers) setAgentFilter("all")
	}, [canManageUsers])

	const agentNameById = useMemo(() => {
		const map = new Map<string, string>()

		agents.forEach((user) => map.set(user.id, user.displayName || user.username))

		return map
	}, [agents])
	// ---------------------------------------------------------------------

	const load = useCallback(
		async (silent = false) => {
			if (inFlight.current) return

			inFlight.current = true

			if (!silent) setLoading(true)

			try {
				const [list, blockedEntries] = await Promise.all([
					api.conversations(filter),
					// Best-effort: only admins/superadmins can read this registry. If it's
					// unavailable (403, network, etc.) reconcileBlocked falls back to the
					// preserve-known-blocked-state strategy instead.
					canManageUsers ? adminApi.listBlockedNumbers("blocked").catch(() => null) : Promise.resolve(null)
				])

				const blockedByPhone = blockedEntries
					? new Map(blockedEntries.map((entry) => [entry.phone, entry] as const))
					: null

				setConversations((current) => reconcileBlocked(list, current, blockedByPhone))
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
		[filter, canManageUsers]
	)

	useEffect(() => {
		void load()
	}, [load])

	useEffect(() => {
		if ((filter === "hidden" || filter === "agent") && !canManageUsers) setFilter("all")

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

		let inTab = conversations.filter((conversation) => matchesFilter(conversation, filter, agent?.id ?? null))

		if (canManageUsers && agentFilter !== "all") {
			inTab = inTab.filter((conversation) => conversation.assigneeId === agentFilter)
		}

		if (!needle) return inTab

		return inTab.filter((conversation) => {
			const name = conversation.customerName?.toLowerCase() ?? ""

			const assigneeName = (
				conversation.assignee?.name ?? (conversation.assigneeId ? agentNameById.get(conversation.assigneeId) : "") ?? ""
			).toLowerCase()

			return name.includes(needle) || conversation.phone.toLowerCase().includes(needle) || assigneeName.includes(needle)
		})
	}, [conversations, search, filter, agent?.id, canManageUsers, agentFilter, agentNameById])

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

	// Upsert used by realtime handlers below. IMPORTANT: `blocked` /
	// `whatsappStatus` are intentionally NEVER touched here — only the
	// dedicated "conversation.blocked" event (below) is allowed to change
	// them. Otherwise a generic "conversation.upserted" frame that happens
	// to arrive right after you block/unblock from the chat panel (with a
	// stale DB snapshot, since the WhatsApp-side block can still be
	// "pending") would silently revert your optimistic update a moment
	// later — which looked like "I have to click the conversation again to
	// see it as blocked."
	const upsert = useCallback((partial: Partial<Conversation> & { id: string }) => {
		const { blocked: _ignoredBlocked, whatsappStatus: _ignoredWhatsappStatus, ...safePartial } = partial

		setConversations((current) => {
			const idx = current.findIndex((conversation) => conversation.id === safePartial.id)

			if (idx === -1) {
				if (!matchesFilter(safePartial, filterRef.current, agentIdRef.current)) return current

				return sortByRecent([{ unreadCount: 0, ...safePartial } as Conversation, ...current])
			}

			const existing = current[idx]

			const merged: Conversation = { ...existing, ...safePartial }

			if (
				safePartial.lastMessageDirection === "inbound" &&
				safePartial.id !== activeIdRef.current &&
				safePartial.unreadCount === undefined
			) {
				merged.unreadCount = (existing.unreadCount ?? 0) + 1
			}

			const next = [...current]

			next[idx] = merged

			return sortByRecent(next)
		})

		setDetached((current) => (current && current.id === safePartial.id ? { ...current, ...safePartial } : current))
	}, [])

	// Dedicated setter for blocked/whatsappStatus — bypasses `upsert`'s guard
	// above on purpose, since this IS the trusted source for that field.
	const upsertBlockedStatus = useCallback(
		(id: string, blocked: boolean, whatsappStatus: Conversation["whatsappStatus"] | null) => {
			setConversations((current) =>
				current.map((conversation) => (conversation.id === id ? { ...conversation, blocked, whatsappStatus } : conversation))
			)
			setDetached((current) => (current && current.id === id ? { ...current, blocked, whatsappStatus } : current))
		},
		[]
	)

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

				case "conversation.blocked": {
					const conversationId = event.conversationId as string | undefined

					if (!conversationId) break

					upsertBlockedStatus(
						conversationId,
						Boolean(event.blocked),
						(event.whatsappStatus as Conversation["whatsappStatus"]) ?? null
					)

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
		[upsert, upsertBlockedStatus, agent]
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
						agents={canManageUsers ? agents : []}
						agentFilter={agentFilter}
						onAgentFilterChange={canManageUsers ? setAgentFilter : undefined}
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