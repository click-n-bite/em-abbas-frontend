"use client"

import { useEffect, useState } from "react"
import { contactsApi } from "@/lib/features/contacts/api"
import { contactErrorKey, formatContactPhone } from "@/lib/features/contacts/format"
import type { ChatSuggestion, Contact, ContactSuggestion } from "@/lib/features/contacts/types"
import { errorDetail, errorKey } from "@/lib/errors"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { Spinner } from "@/components/ui/spinner"
import { ChannelBadge } from "@/components/ui/channel-badge"

const bannerClass =
	"flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-900/30 dark:text-brand-100"

export function ChatContactSuggestions({
	conversationId,
	onLinked
}: {
	conversationId: string
	onLinked: (contact: Contact) => void
}) {
	const { t } = useI18n()

	const { push } = useToast()

	const [items, setItems] = useState<ContactSuggestion[]>([])

	const [dismissed, setDismissed] = useState<Set<number>>(new Set())

	const [busyId, setBusyId] = useState<number | null>(null)

	useEffect(() => {
		const controller = new AbortController()

		setItems([])
		setDismissed(new Set())

		contactsApi
			.contactSuggestions(conversationId, controller.signal)
			.then(setItems)
			.catch(() => setItems([]))

		return () => controller.abort()
	}, [conversationId])

	const visible = items.filter((item) => !dismissed.has(item.id))

	if (visible.length === 0) return null

	const link = async (id: number) => {
		setBusyId(id)

		try {
			onLinked(await contactsApi.link(id, conversationId))
		} catch (error) {
			const key = contactErrorKey(error)

			push(key ? t(key) : (errorDetail(error) ?? t(errorKey(error))), "error")
		} finally {
			setBusyId(null)
		}
	}

	return (
		<div className='space-y-1.5'>
			{visible.map((item) => (
				<div key={item.id} className={bannerClass}>
					<span className='min-w-0 flex-1'>{t("contacts.suggest.contactMayFit", { name: item.displayName })}</span>
					<button
						type='button'
						className='btn-primary px-2.5 py-1 text-xs'
						disabled={busyId !== null}
						onClick={() => void link(item.id)}>
						{busyId === item.id ? <Spinner /> : null}
						{t("contacts.suggest.link")}
					</button>
					<button
						type='button'
						className='btn-ghost px-2.5 py-1 text-xs'
						onClick={() => setDismissed((set) => new Set(set).add(item.id))}>
						{t("contacts.suggest.dismiss")}
					</button>
				</div>
			))}
		</div>
	)
}

export function ContactChatSuggestions({
	contactId,
	refreshKey,
	onLinked
}: {
	contactId: number
	/** Change this to reload, e.g. after a phone was added. */
	refreshKey?: string | number
	onLinked: (contact: Contact) => void
}) {
	const { t } = useI18n()

	const { push } = useToast()

	const [items, setItems] = useState<ChatSuggestion[]>([])

	const [dismissed, setDismissed] = useState<Set<string>>(new Set())

	const [busyId, setBusyId] = useState<string | null>(null)

	useEffect(() => {
		const controller = new AbortController()

		contactsApi
			.chatSuggestions(contactId, controller.signal)
			.then(setItems)
			.catch(() => setItems([]))

		return () => controller.abort()
	}, [contactId, refreshKey])

	const visible = items.filter((item) => !dismissed.has(item.conversationId))

	if (visible.length === 0) return null

	const link = async (conversationId: string) => {
		setBusyId(conversationId)

		try {
			onLinked(await contactsApi.link(contactId, conversationId))
		} catch (error) {
			const key = contactErrorKey(error)

			push(key ? t(key) : (errorDetail(error) ?? t(errorKey(error))), "error")
		} finally {
			setBusyId(null)
		}
	}

	return (
		<div className='space-y-1.5'>
			{visible.map((item) => (
				<div key={item.conversationId} className={bannerClass}>
					<ChannelBadge channel={item.channel} />
					<span className='min-w-0 flex-1'>
						{t("contacts.suggest.chatMayBelong", {
							phone: formatContactPhone(item.phone) || (item.customerName ?? "")
						})}
					</span>
					<button
						type='button'
						className='btn-primary px-2.5 py-1 text-xs'
						disabled={busyId !== null}
						onClick={() => void link(item.conversationId)}>
						{busyId === item.conversationId ? <Spinner /> : null}
						{t("contacts.suggest.link")}
					</button>
					<button
						type='button'
						className='btn-ghost px-2.5 py-1 text-xs'
						onClick={() => setDismissed((set) => new Set(set).add(item.conversationId))}>
						{t("contacts.suggest.dismiss")}
					</button>
				</div>
			))}
		</div>
	)
}
