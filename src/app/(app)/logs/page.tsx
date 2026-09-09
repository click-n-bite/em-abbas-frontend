// app/activity/page.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, Bot, User, Shield, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import {
	ActivityActorType,
	ActivityEventType,
	ConversationActivityEvent,
	ConversationActivityResponse,
	Conversation
} from "@/lib/types"

const EVENT_ICONS: Record<ActivityEventType, React.ReactNode> = {
	"ai.started": <Bot className='h-4 w-4' />,
	"handoff.requested": <Bot className='h-4 w-4' />,
	"agent.took_over": <User className='h-4 w-4' />,
	handed_to_ai: <Bot className='h-4 w-4' />,
	"number.blocked": <Shield className='h-4 w-4' />,
	"number.unblocked": <Shield className='h-4 w-4' />,
	"conversation.hidden": <Activity className='h-4 w-4' />,
	"conversation.unhidden": <Activity className='h-4 w-4' />,
	"conversation.cleared": <Activity className='h-4 w-4' />
}

const ACTOR_ICONS: Record<ActivityActorType, React.ReactNode> = {
	user: <User className='h-3.5 w-3.5' />,
	bot: <Bot className='h-3.5 w-3.5' />,
	system: <Shield className='h-3.5 w-3.5' />
}

const EVENT_COLORS: Record<ActivityEventType, string> = {
	"ai.started": "text-brand-600 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-200",
	"handoff.requested": "text-amber-600 bg-amber-50 dark:bg-amber-900/40 dark:text-amber-200",
	"agent.took_over": "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-200",
	handed_to_ai: "text-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-200",
	"number.blocked": "text-rose-600 bg-rose-50 dark:bg-rose-900/40 dark:text-rose-200",
	"number.unblocked": "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-200",
	"conversation.hidden": "text-ink-600 bg-ink-50 dark:bg-ink-700/40 dark:text-ink-200",
	"conversation.unhidden": "text-ink-600 bg-ink-50 dark:bg-ink-700/40 dark:text-ink-200",
	"conversation.cleared": "text-ink-600 bg-ink-50 dark:bg-ink-700/40 dark:text-ink-200"
}

const EVENT_LABELS: Record<ActivityEventType, string> = {
	"ai.started": "ai started",
	"handoff.requested": "activity.events.handoff.requested",
	"agent.took_over": "activity.events.agent.took_over",
	handed_to_ai: "activity.events.handed_to_ai",
	"number.blocked": "activity.events.number.blocked",
	"number.unblocked": "activity.events.number.unblocked",
	"conversation.hidden": "activity.events.conversation.hidden",
	"conversation.unhidden": "activity.events.conversation.unhidden",
	"conversation.cleared": "activity.events.conversation.cleared"
}

const PAGE_SIZE = 4

interface ConversationLabel {
	name: string
	phone: string
}

function getEventColor(eventType: ActivityEventType): string {
	return EVENT_COLORS[eventType] || "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200"
}

function getEventIcon(eventType: ActivityEventType): React.ReactNode {
	return EVENT_ICONS[eventType] || <Activity className='h-4 w-4' />
}

function getActorIcon(actorType: ActivityActorType): React.ReactNode {
	return ACTOR_ICONS[actorType] || <User className='h-3.5 w-3.5' />
}

export default function ActivityPage() {
	const { t, formatDateTime } = useI18n()

	const { push } = useToast()

	const router = useRouter()

	const [loading, setLoading] = useState(true)

	const [activities, setActivities] = useState<ConversationActivityResponse[]>([])

	const [filteredEvents, setFilteredEvents] = useState<ConversationActivityEvent[]>([])

	const [total, setTotal] = useState(0)

	// id -> { name, phone }, built from the conversations we fetch below, so
	// the list can show the customer and let search match either field.
	const [conversationLabels, setConversationLabels] = useState<Map<string, ConversationLabel>>(new Map())

	// Filters
	const [search, setSearch] = useState("")

	const [eventTypeFilter, setEventTypeFilter] = useState<ActivityEventType | "all">("all")

	const [actorFilter, setActorFilter] = useState<ActivityActorType | "all">("all")

	const [page, setPage] = useState(0)

	const loadActivities = useCallback(
		async (signal?: AbortSignal) => {
			try {
				setLoading(true)

				const conversations = await api.conversations("all", signal)

				setConversationLabels(
					new Map(
						conversations.map((conv: Conversation) => [
							conv.id,
							{ name: conv.customerName?.trim() ?? "", phone: conv.phone ?? "" }
						])
					)
				)

				const activityPromises = conversations.map((conv) =>
					api.conversationActivity(conv.id, signal).catch(() => null)
				)

				const results = await Promise.all(activityPromises)

				const validResults = results.filter((r): r is ConversationActivityResponse => r !== null)

				setActivities(validResults)

				let allEvents: ConversationActivityEvent[] = []

				validResults.forEach((activity) => {
					allEvents = [...allEvents, ...activity.events]
				})

				// Newest first
				allEvents.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

				setTotal(allEvents.length)
				applyFilters(allEvents)
			} catch (error) {
				console.log(error)
				push(t("errors.generic"), "error")
			} finally {
				setLoading(false)
			}
		},
		[push, t]
	)

	const applyFilters = useCallback(
		(events: ConversationActivityEvent[]) => {
			let filtered = [...events]

			// Search filter — matches the event summary/actor/type, OR the
			// conversation's customer name, OR their phone number.
			if (search.trim()) {
				const term = search.trim().toLowerCase()

				filtered = filtered.filter((event) => {
					const label = conversationLabels.get(event.conversationId)

					return (
						event.summary.toLowerCase().includes(term) ||
						event.actorName?.toLowerCase().includes(term) ||
						event.eventType.toLowerCase().includes(term) ||
						Boolean(label?.name.toLowerCase().includes(term)) ||
						Boolean(label?.phone.toLowerCase().includes(term))
					)
				})
			}

			// Event type filter
			if (eventTypeFilter !== "all") {
				filtered = filtered.filter((event) => event.eventType === eventTypeFilter)
			}

			// Actor filter
			if (actorFilter !== "all") {
				filtered = filtered.filter((event) => event.actorType === actorFilter)
			}

			// Newest first, always re-asserted here in case events came from
			// multiple conversations merged in a different order
			filtered.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

			// Pagination
			const start = page * PAGE_SIZE

			const end = start + PAGE_SIZE

			setFilteredEvents(filtered.slice(start, end))
			setTotal(filtered.length)
		},
		[search, eventTypeFilter, actorFilter, page, conversationLabels]
	)

	useEffect(() => {
		const abortController = new AbortController()

		loadActivities(abortController.signal)

		return () => abortController.abort()
	}, [loadActivities])

	useEffect(() => {
		// Re-apply filters when they change
		const allEvents: ConversationActivityEvent[] = []

		activities.forEach((activity) => {
			allEvents.push(...activity.events)
		})
		allEvents.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
		applyFilters(allEvents)
	}, [search, eventTypeFilter, actorFilter, page, activities, applyFilters])

	const handleRefresh = () => {
		loadActivities()
	}

	const handleConversationClick = (conversationId: string) => {
		router.push(`/conversations?id=${conversationId}`)
	}

	const customerDisplayOf = useCallback(
		(conversationId: string) => {
			const label = conversationLabels.get(conversationId)

			if (!label) return conversationId

			if (label.name && label.phone) return `${label.name} • ${label.phone}`

			return label.name || label.phone || conversationId
		},
		[conversationLabels]
	)

	// Get unique event types for filter dropdown
	const uniqueEventTypes = Array.from(new Set(activities.flatMap((a) => a.events.map((e) => e.eventType))))

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

	return (
		<AppShell
			title={t("activity.title")}
			subtitle={t("activity.subtitle")}
			actions={
				<div className='flex items-center gap-2'>
					<button
						type='button'
						onClick={handleRefresh}
						className='btn-secondary px-3 py-2'
						aria-label={t("common.refresh")}
						title={t("common.refresh")}>
						<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden='true' />
					</button>
				</div>
			}>
			<section className='card overflow-hidden'>
				{/* Filters - same design as Leads page */}
				<header className='flex flex-col gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex items-center gap-2'>
						<Activity className='h-4 w-4 text-brand-500' aria-hidden='true' />
						<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("activity.title")}</h2>
						<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>{total}</span>
					</div>

					<div className='flex flex-wrap items-center gap-2'>
						<div className='relative w-full sm:w-56'>
							<Search
								className='pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400'
								aria-hidden='true'
							/>
							<input
								value={search}
								onChange={(e) => {
									setSearch(e.target.value)
									setPage(0)
								}}
								placeholder={t("activity.searchPlaceholder")}
								aria-label={t("common.search")}
								className='input w-full ps-9'
							/>
						</div>

						<select
							value={eventTypeFilter}
							onChange={(e) => {
								setEventTypeFilter(e.target.value as ActivityEventType | "all")
								setPage(0)
							}}
							className='input w-auto'
							aria-label={t("activity.filterEventType")}>
							<option value='all'>{t("activity.eventTypeAll")}</option>
							{uniqueEventTypes.map((type) => (
								<option key={type} value={type}>
									{t(EVENT_LABELS[type] || type)}
								</option>
							))}
						</select>

						<select
							value={actorFilter}
							onChange={(e) => {
								setActorFilter(e.target.value as ActivityActorType | "all")
								setPage(0)
							}}
							className='input w-auto'
							aria-label={t("activity.filterActor")}>
							<option value='all'>{t("activity.actorAll")}</option>
							<option value='user'>{t("activity.actorUser")}</option>
							<option value='bot'>{t("activity.actorBot")}</option>
							<option value='system'>{t("activity.actorSystem")}</option>
						</select>
					</div>
				</header>

				{/* Activity List */}
				{loading && filteredEvents.length === 0 ? (
					<ul className='space-y-3 p-5'>
						{[0, 1, 2, 3].map((index) => (
							<li key={index} className='skeleton h-16 w-full' />
						))}
					</ul>
				) : filteredEvents.length === 0 ? (
					<EmptyState icon={<Activity className='h-5 w-5' aria-hidden='true' />} title={t("activity.empty")} />
				) : (
					<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
						{filteredEvents.map((event) => (
							<li
								key={event.id}
								className='flex flex-wrap items-start gap-3 px-5 py-4 transition-colors hover:bg-ink-50/50 dark:hover:bg-ink-700/30'
								onClick={() => handleConversationClick(event.conversationId)}>
								{/* Icon - same as before */}
								<div
									className={cn(
										"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
										getEventColor(event.eventType)
									)}>
									{getEventIcon(event.eventType)}
								</div>

								{/* Content */}
								<div className='min-w-0 flex-1'>
									<div className='flex flex-wrap items-center gap-2'>
										<span className='text-sm font-medium text-ink-900 dark:text-ink-50'>
											{t(EVENT_LABELS[event.eventType] || event.eventType)}
										</span>

										<span className='flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-700 dark:text-ink-200'>
											{getActorIcon(event.actorType)}
											{event.actorName || t("activity.unknownActor")}
										</span>
									</div>

									<p className='mt-0.5 text-sm text-ink-600 dark:text-ink-300'>{event.summary}</p>

									<div className='mt-1 flex items-center gap-3 text-xs text-ink-400 dark:text-ink-500'>
										<span>{formatDateTime(event.occurredAt)}</span>
										<span>•</span>
										<span className='truncate' dir='auto'>
											{customerDisplayOf(event.conversationId)}
										</span>
									</div>

									{/* Payload details */}
									{event.payload && Object.keys(event.payload).length > 0 && (
										<details className='mt-2'>
											<summary className='cursor-pointer text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-300'>
												{t("activity.showDetails")}
											</summary>
											<pre className='mt-1 overflow-x-auto rounded-lg bg-ink-50 p-2 text-xs dark:bg-ink-800/50'>
												{JSON.stringify(event.payload, null, 2)}
											</pre>
										</details>
									)}
								</div>

								{/* Conversation link - same as Leads page style */}
								<button
									type='button'
									onClick={(e) => {
										e.stopPropagation()
										handleConversationClick(event.conversationId)
									}}
									className='btn-ghost shrink-0'
									aria-label={t("activity.viewConversation")}
									title={t("activity.viewConversation")}>
									<Activity className='h-4 w-4' aria-hidden='true' />
									<span className='hidden sm:inline'>{t("activity.viewConversation")}</span>
								</button>
							</li>
						))}
					</ul>
				)}

				{/* Pagination - same design as Leads page */}
				{totalPages > 1 ? (
					<div className='flex items-center justify-center gap-3 border-t border-ink-200 px-5 py-3 dark:border-ink-700'>
						<button
							type='button'
							className='btn-ghost px-2.5'
							disabled={page === 0}
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							aria-label={t("common.previous")}>
							<ChevronLeft className='h-4 w-4' aria-hidden='true' />
						</button>
						<span className='text-xs text-ink-500 dark:text-ink-400'>
							{page + 1} / {totalPages}
						</span>
						<button
							type='button'
							className='btn-ghost px-2.5'
							disabled={page + 1 >= totalPages}
							onClick={() => setPage((p) => p + 1)}
							aria-label={t("common.next")}>
							<ChevronRight className='h-4 w-4' aria-hidden='true' />
						</button>
					</div>
				) : null}
			</section>
		</AppShell>
	)
}
