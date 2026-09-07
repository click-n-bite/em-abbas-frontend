"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import { useI18n } from "@/providers/i18n-provider"
import { api } from "@/lib/api"
import type { Conversation } from "@/lib/types"
import type { CreateLeadPayload } from "@/lib/api"
import { LeadService } from "@/lib/features/leads/types"

interface Props {
	open: boolean
	initialConversationId?: string | null
	onClose: () => void
	onSubmit: (payload: CreateLeadPayload) => Promise<void>
}

export function LeadFormModal({ open, initialConversationId, onClose, onSubmit }: Props) {
	const { t } = useI18n()

	const [conversations, setConversations] = useState<Conversation[]>([])

	const [services, setServices] = useState<LeadService[]>([])

	const [loadingOptions, setLoadingOptions] = useState(false)

	const [conversationQuery, setConversationQuery] = useState("")

	const [conversationId, setConversationId] = useState<string | null>(null)

	const [serviceId, setServiceId] = useState<number | null>(null)

	const [note, setNote] = useState("")

	const [busy, setBusy] = useState(false)

	const [touched, setTouched] = useState(false)

	useEffect(() => {
		if (!open) return

		setConversationQuery("")
		setConversationId(initialConversationId ?? null)
		setServiceId(null)
		setNote("")
		setTouched(false)
		setBusy(false)
		setLoadingOptions(true)

		const controller = new AbortController()

		Promise.all([api.conversations("all", controller.signal), api.leadServices(controller.signal)])
			.then(([conversationList, serviceList]) => {
				setConversations(conversationList)
				setServices(serviceList)

				if (serviceList.length === 1) setServiceId(serviceList[0].id)
			})
			.catch(() => undefined)
			.finally(() => setLoadingOptions(false))

		return () => controller.abort()
	}, [open, initialConversationId])

	const matches = useMemo(() => {
		const needle = conversationQuery.trim().toLowerCase()

		const pool = needle
			? conversations.filter((entry) => `${entry.customerName ?? ""} ${entry.phone}`.toLowerCase().includes(needle))
			: conversations

		return pool.slice(0, 20)
	}, [conversations, conversationQuery])

	const selectedConversation = useMemo(
		() => conversations.find((entry) => entry.id === conversationId) ?? null,
		[conversations, conversationId]
	)

	const submit = async () => {
		setTouched(true)

		if (!conversationId || !serviceId || busy) return

		setBusy(true)

		try {
			await onSubmit({ conversationId, serviceId, note: note.trim() || undefined })
		} finally {
			setBusy(false)
		}
	}

	return (
		<Modal
			open={open}
			title={t("leads.addTitle")}
			description={t("leads.addSubtitle")}
			onClose={busy ? () => undefined : onClose}
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={busy}>
						{t("common.cancel")}
					</button>
					<button type='button' className='btn-primary' onClick={() => void submit()} disabled={busy}>
						{busy ? <Spinner /> : null}
						{busy ? t("leads.adding") : t("leads.add")}
					</button>
				</>
			}>
			<form
				className='space-y-4'
				onSubmit={(event) => {
					event.preventDefault()
					void submit()
				}}>
				<div>
					<label className='label' htmlFor='lead-conversation'>
						{t("leads.conversation")}
					</label>

					{selectedConversation ? (
						<div className='flex items-center justify-between gap-2 rounded-xl border border-ink-200 px-3 py-2 dark:border-ink-700'>
							<div className='min-w-0'>
								<p className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
									{selectedConversation.customerName || `+${selectedConversation.phone}`}
								</p>
								{selectedConversation.customerName ? (
									<p dir='ltr' className='truncate text-xs text-ink-500 dark:text-ink-400'>
										+{selectedConversation.phone}
									</p>
								) : null}
							</div>
							<button
								type='button'
								className='btn-ghost shrink-0 px-2 py-1 text-xs'
								onClick={() => setConversationId(null)}>
								{t("common.edit")}
							</button>
						</div>
					) : (
						<>
							<div className='relative'>
								<Search
									className='pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400'
									aria-hidden='true'
								/>
								<input
									id='lead-conversation'
									className='input ps-9'
									value={conversationQuery}
									onChange={(event) => setConversationQuery(event.target.value)}
									placeholder={t("leads.conversationPlaceholder")}
									autoComplete='off'
								/>
							</div>

							<div className='mt-2 max-h-48 overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700'>
								{loadingOptions ? (
									<div className='flex items-center justify-center py-4'>
										<Spinner />
									</div>
								) : matches.length === 0 ? (
									<p className='px-3 py-3 text-xs text-ink-500 dark:text-ink-400'>{t("leads.noConversationsFound")}</p>
								) : (
									<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
										{matches.map((entry) => (
											<li key={entry.id}>
												<button
													type='button'
													className='flex w-full flex-col items-start px-3 py-2 text-start hover:bg-ink-50 dark:hover:bg-ink-700/60'
													onClick={() => setConversationId(entry.id)}>
													<span className='truncate text-sm text-ink-900 dark:text-ink-50'>
														{entry.customerName || `+${entry.phone}`}
													</span>
													{entry.customerName ? (
														<span dir='ltr' className='truncate text-xs text-ink-500 dark:text-ink-400'>
															+{entry.phone}
														</span>
													) : null}
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						</>
					)}

					{touched && !conversationId ? (
						<p className='mt-1 text-xs text-rose-600 dark:text-rose-400'>{t("leads.conversationRequired")}</p>
					) : null}
				</div>

				<div>
					<label className='label' htmlFor='lead-service'>
						{t("leads.service")}
					</label>
					<select
						id='lead-service'
						className='input'
						value={serviceId ?? ""}
						onChange={(event) => setServiceId(event.target.value ? Number(event.target.value) : null)}>
						<option value='' disabled>
							{t("leads.service")}
						</option>
						{services.map((service) => (
							<option key={service.id} value={service.id}>
								{service.name}
							</option>
						))}
					</select>
					{touched && !serviceId ? (
						<p className='mt-1 text-xs text-rose-600 dark:text-rose-400'>{t("leads.serviceRequired")}</p>
					) : null}
				</div>

				<div>
					<label className='label' htmlFor='lead-note'>
						{t("leads.note")} <span className='text-ink-400'>({t("common.optional")})</span>
					</label>
					<textarea
						id='lead-note'
						rows={3}
						className='input resize-y py-2.5'
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder={t("leads.notePlaceholder")}
						maxLength={500}
					/>
				</div>

				<button type='submit' className='sr-only'>
					{t("leads.add")}
				</button>
			</form>
		</Modal>
	)
}
