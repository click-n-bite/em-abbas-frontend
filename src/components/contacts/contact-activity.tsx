"use client"

import { eventText } from "@/lib/features/contacts/format"
import type { ContactEvent } from "@/lib/features/contacts/types"
import { useI18n } from "@/providers/i18n-provider"

export function ContactActivity({ events, loading }: { events: ContactEvent[]; loading: boolean }) {
	const { t, formatDateTime } = useI18n()

	if (loading && events.length === 0) {
		return <span className='skeleton block h-10 w-full' />
	}

	if (events.length === 0) {
		return <p className='text-sm text-ink-500 dark:text-ink-400'>{t("contacts.card.noActivity")}</p>
	}

	return (
		<ol className='space-y-3'>
			{events.map((event) => (
				<li key={event.id} className='flex gap-3 text-sm'>
					<span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500' aria-hidden='true' />
					<div className='min-w-0'>
						<p className='text-ink-800 dark:text-ink-100'>{eventText(event, t)}</p>
						<p className='text-xs text-ink-500 dark:text-ink-400'>
							{event.actor?.name ?? t("contacts.card.staff")}
							{" · "}
							<time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
						</p>
					</div>
				</li>
			))}
		</ol>
	)
}
