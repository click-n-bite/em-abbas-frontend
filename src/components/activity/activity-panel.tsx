"use client"

import { useEffect, useState } from "react"
import {
	AlertCircle,
	Bot,
	Eraser,
	Eye,
	EyeOff,
	Headphones,
	ShieldAlert,
	ShieldOff,
	Undo2,
	UserRound
} from "lucide-react"
import { ApiError, activityApi } from "@/lib/api"
import { errorKey } from "@/lib/errors"
import { useI18n } from "@/providers/i18n-provider"
import { EmptyState } from "@/components/ui/empty-state"
import type { ConversationActivityEvent } from "@/lib/types"

interface Props {
	conversationId: string
	active: boolean
}

const eventIcons: Record<string, typeof Bot> = {
	"ai.started": Bot,
	"handoff.requested": AlertCircle,
	"agent.took_over": Headphones,
	handed_to_ai: Undo2,
	"number.blocked": ShieldOff,
	"number.unblocked": Undo2,
	"conversation.hidden": EyeOff,
	"conversation.unhidden": Eye,
	"conversation.cleared": Eraser
}

function EventRow({ event }: { event: ConversationActivityEvent }) {
	const { formatDateTime } = useI18n()

	const Icon = eventIcons[event.eventType] ?? UserRound

	return (
		<li className='flex animate-fade-in gap-3 px-5 py-3.5'>
			<span className='mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-300'>
				<Icon className='h-3.5 w-3.5' aria-hidden='true' />
			</span>
			<div className='min-w-0 flex-1'>
				<p className='text-sm text-ink-800 dark:text-ink-100'>{event.summary}</p>
				<p className='mt-0.5 text-xs text-ink-400'>{formatDateTime(event.occurredAt)}</p>
			</div>
		</li>
	)
}

export function ActivityPanel({ conversationId, active }: Props) {
	const { t } = useI18n()

	const [events, setEvents] = useState<ConversationActivityEvent[]>([])

	const [loading, setLoading] = useState(false)

	const [failure, setFailure] = useState<string | null>(null)

	const [forbidden, setForbidden] = useState(false)

	useEffect(() => {
		if (!active || !conversationId) return

		const controller = new AbortController()

		setLoading(true)
		setFailure(null)
		setForbidden(false)

		activityApi
			.get(conversationId, controller.signal)
			.then((response) => {
				const sorted = [...response.events].sort(
					(a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
				)

				setEvents(sorted)
			})
			.catch((error) => {
				if ((error as Error)?.name === "AbortError") return

				if (error instanceof ApiError && error.status === 403) {
					setForbidden(true)

					return
				}

				setFailure(errorKey(error))
			})
			.finally(() => setLoading(false))

		return () => controller.abort()
	}, [active, conversationId])

	if (!active) return null

	if (forbidden) {
		return (
			<div className='flex h-full items-center justify-center'>
				<EmptyState icon={<ShieldAlert className='h-5 w-5' aria-hidden='true' />} title={t("activity.forbidden")} />
			</div>
		)
	}

	if (loading && events.length === 0) {
		return (
			<div className='flex flex-col gap-3 px-5 py-4'>
				{[0, 1, 2].map((index) => (
					<span key={index} className='skeleton h-10 w-full' />
				))}
			</div>
		)
	}

	if (failure) {
		return (
			<div className='flex h-full items-center justify-center'>
				<EmptyState icon={<AlertCircle className='h-5 w-5' aria-hidden='true' />} title={t(failure)} />
			</div>
		)
	}

	if (events.length === 0) {
		return (
			<div className='flex h-full items-center justify-center'>
				<EmptyState icon={<UserRound className='h-5 w-5' aria-hidden='true' />} title={t("activity.empty")} />
			</div>
		)
	}

	return (
		<ul className='min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto dark:divide-ink-700/70'>
			{events.map((event) => (
				<EventRow key={event.id} event={event} />
			))}
		</ul>
	)
}
