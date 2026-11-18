"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { contactsApi } from "@/lib/features/contacts/api"
import { contactErrorKey, errorCodeOf, errorDataOf, formatContactPhone } from "@/lib/features/contacts/format"
import type { Contact, ContactSummary } from "@/lib/features/contacts/types"
import { errorDetail, errorKey } from "@/lib/errors"
import { useI18n } from "@/providers/i18n-provider"
import { Avatar } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import { TrustedStar } from "@/components/contacts/trusted-star"
import { textDirOf } from "@/lib/utils"

interface Props {
	open: boolean
	conversationId: string
	onClose: () => void
	onLinked: (contact: Contact) => void
}

export function ContactPickerModal({ open, conversationId, onClose, onLinked }: Props) {
	const { t } = useI18n()

	const [query, setQuery] = useState("")

	const [items, setItems] = useState<ContactSummary[]>([])

	const [loading, setLoading] = useState(false)

	const [busyId, setBusyId] = useState<number | null>(null)

	const [error, setError] = useState<string | null>(null)

	const [owner, setOwner] = useState<{ id: number; name: string } | null>(null)

	useEffect(() => {
		if (!open) return

		setQuery("")
		setError(null)
		setOwner(null)
	}, [open])

	useEffect(() => {
		if (!open) return

		const controller = new AbortController()

		// Searching by phone needs at least 3 digits; the API handles that.
		const timer = window.setTimeout(() => {
			setLoading(true)

			contactsApi
				.list({ search: query.trim() || undefined, page: 0, size: 20 }, controller.signal)
				.then((result) => setItems(result.items))
				.catch((err) => {
					if ((err as Error)?.name !== "AbortError") setItems([])
				})
				.finally(() => setLoading(false))
		}, 250)

		return () => {
			window.clearTimeout(timer)
			controller.abort()
		}
	}, [open, query])

	if (!open) return null

	const pick = async (contact: ContactSummary) => {
		if (busyId !== null) return

		setBusyId(contact.id)
		setError(null)
		setOwner(null)

		try {
			const updated = await contactsApi.link(contact.id, conversationId)

			onLinked(updated)
			onClose()
		} catch (err) {
			if (errorCodeOf(err) === "CUSTOMER_ALREADY_LINKED") {
				const data = errorDataOf(err)

				setOwner({
					id: Number(data.contactId),
					name: String(data.contactName ?? "")
				})
			} else {
				const key = contactErrorKey(err)

				setError(key ? t(key) : (errorDetail(err) ?? t(errorKey(err))))
			}
		} finally {
			setBusyId(null)
		}
	}

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
			role='dialog'
			aria-modal='true'
			onClick={onClose}>
			<div
				onClick={(event) => event.stopPropagation()}
				className='flex max-h-[80dvh] w-full max-w-md flex-col rounded-2xl border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-800'>
				<h3 className='border-b border-ink-200 px-5 py-3 text-sm font-semibold text-ink-900 dark:border-ink-700 dark:text-ink-50'>
					{t("contacts.picker.title")}
				</h3>

				<div className='relative px-4 pt-3'>
					<Search
						className='pointer-events-none absolute inset-y-0 start-7 mt-1.5 h-4 w-4 self-center text-ink-400'
						aria-hidden='true'
					/>
					<input
						autoFocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("contacts.picker.search")}
						aria-label={t("contacts.picker.search")}
						className='input h-10 w-full ps-9'
					/>
				</div>

				{owner ? (
					<div
						role='alert'
						className='mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100'>
						<span>{t("contacts.errors.alreadyLinked", { name: owner.name })}</span>
						<Link href={`/contacts/${owner.id}`} className='font-semibold underline' onClick={onClose}>
							{t("contacts.openContact")}
						</Link>
					</div>
				) : null}

				{error ? (
					<p role='alert' className='px-5 pt-3 text-xs text-rose-600 dark:text-rose-300'>
						{error}
					</p>
				) : null}

				<ul className='mt-2 min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto dark:divide-ink-700/70'>
					{loading && items.length === 0 ? (
						<li className='flex justify-center p-6'>
							<Spinner />
						</li>
					) : items.length === 0 ? (
						<li className='p-6 text-center text-sm text-ink-500 dark:text-ink-400'>{t("contacts.picker.none")}</li>
					) : (
						items.map((contact) => (
							<li key={contact.id}>
								<button
									type='button'
									disabled={busyId !== null}
									onClick={() => void pick(contact)}
									className='flex w-full items-center gap-3 px-4 py-2.5 text-start transition hover:bg-ink-50 disabled:opacity-60 dark:hover:bg-ink-700/50'>
									<Avatar name={contact.displayName} seed={String(contact.id)} size='sm' />
									<span className='min-w-0 flex-1'>
										<span
											dir={textDirOf(contact.displayName)}
											className='flex items-center gap-1 truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
											{contact.displayName}
											{contact.trusted ? <TrustedStar /> : null}
										</span>
										<span dir='ltr' className='block truncate text-xs text-ink-500 dark:text-ink-400'>
											{contact.phones.length > 0
												? contact.phones.map((p) => formatContactPhone(p.phone)).join(" · ")
												: t("contacts.noPhones")}
										</span>
									</span>
									{busyId === contact.id ? <Spinner /> : null}
								</button>
							</li>
						))
					)}
				</ul>

				<div className='flex justify-end border-t border-ink-200 px-5 py-3 dark:border-ink-700'>
					<button type='button' className='btn-secondary px-3 py-1.5 text-xs' onClick={onClose}>
						{t("common.cancel")}
					</button>
				</div>
			</div>
		</div>
	)
}
