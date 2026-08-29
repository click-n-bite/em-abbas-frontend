"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { errorKey } from "@/lib/errors"
import { usePoll } from "@/hooks/use-poll"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { AppShell } from "@/components/layout/app-shell"
import { ChatPanel } from "@/components/chat/chat-panel"
import { ConversationList, type InboxFilter } from "@/components/chat/conversation-list"
import { cn } from "@/lib/utils"
import type { Conversation, Message } from "@/lib/types"

const FILTERS: InboxFilter[] = ["all", "waiting", "bot", "mine"]

function sortByRecent(list: Conversation[]): Conversation[] {
	return [...list].sort((a, b) => {
		const left = a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? ""

		const right = b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? ""

		return right.localeCompare(left)
	})
}

export default function ConversationsPage() {
	const router = useRouter()

	const params = useSearchParams()

	const { t } = useI18n()

	const { agent } = useAuth()

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
				setConversations(await api.conversations(filter))
				setFailure(null)
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

		if (!needle) return conversations

		return conversations.filter((conversation) => {
			const name = conversation.customerName?.toLowerCase() ?? ""

			return name.includes(needle) || conversation.phone.toLowerCase().includes(needle)
		})
	}, [conversations, search])

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
				<div className={cn("card min-h-0 overflow-hidden", selected ? " lg:block" : "block")}>
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
					/>
				</div>

				<div className={cn("card min-h-0 overflow-hidden", selected ? "block" : " lg:block")}>
					<ChatPanel
						conversation={selected}
						onConversationChange={onConversationChange}
					/>
				</div>
			</div>
		</AppShell>
	)
}
