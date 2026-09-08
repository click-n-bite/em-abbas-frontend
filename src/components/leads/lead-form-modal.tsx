"use client"

import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import { useI18n } from "@/providers/i18n-provider"
import { leadsApi } from "@/lib/api"
import type { LeadService } from "@/lib/types"
import { MAX_NOTE_LENGTH } from "@/lib/config"

interface ConversationOption {
	id: string
	label: string
}

interface Props {
	open: boolean
	onClose: () => void
	onSubmit: (payload: { conversationId: string; serviceId: number; note?: string }) => Promise<void>
	/** When set, the conversation is fixed (e.g. opened from inside a chat) and the picker is hidden. */
	fixedConversation?: ConversationOption
	/** Otherwise, pass the list of conversations the user may attach a lead to (e.g. from the leads page). */
	conversationOptions?: ConversationOption[]
}

export function LeadFormModal({ open, onClose, onSubmit, fixedConversation, conversationOptions }: Props) {
	const { t } = useI18n()

	const [services, setServices] = useState<LeadService[]>([])

	const [conversationId, setConversationId] = useState("")

	const [serviceId, setServiceId] = useState("")

	const [note, setNote] = useState("")

	const [submitting, setSubmitting] = useState(false)

	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open) return

		setConversationId(fixedConversation?.id ?? "")
		setServiceId("")
		setNote("")
		setError(null)

		leadsApi
			.services()
			.then(setServices)
			.catch(() => setServices([]))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	const submit = async () => {
		if (!conversationId || !serviceId || submitting) return

		setSubmitting(true)
		setError(null)

		try {
			await onSubmit({ conversationId, serviceId: Number(serviceId), note: note.trim() || undefined })
		} catch (err) {
			setError((err as Error)?.message ?? null)
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<Modal
			open={open}
			title={t("leads.addTitle")}
			description={t("leads.addSubtitle")}
			onClose={submitting ? () => undefined : onClose}
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={submitting}>
						{t("common.cancel")}
					</button>
					<button
						type='button'
						className='btn-primary'
						onClick={() => void submit()}
						disabled={submitting || !conversationId || !serviceId}>
						{submitting ? <Spinner /> : null}
						{submitting ? t("leads.adding") : t("leads.add")}
					</button>
				</>
			}>
			<div className='space-y-4'>
				{!fixedConversation ? (
					<label className='block'>
						<span className='mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200'>
							{t("leads.conversation")}
						</span>
						<select
							value={conversationId}
							onChange={(event) => setConversationId(event.target.value)}
							className='input'>
							<option value='' disabled>
								{t("leads.conversationPlaceholder")}
							</option>
							{(conversationOptions ?? []).map((option) => (
								<option key={option.id} value={option.id}>
									{option.label}
								</option>
							))}
						</select>
						{(conversationOptions ?? []).length === 0 ? (
							<p className='mt-1.5 text-xs text-ink-400'>{t("leads.noConversationsHint")}</p>
						) : null}
					</label>
				) : null}

				<label className='block'>
					<span className='mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200'>{t("leads.service")}</span>
					<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className='input'>
						<option value='' disabled>
							{t("leads.servicePlaceholder")}
						</option>
						{services.map((service) => (
							<option key={service.id} value={service.id}>
								{service.name}
							</option>
						))}
					</select>
				</label>

				<label className='block'>
					<span className='mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200'>{t("leads.note")}</span>
					<textarea
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder={t("leads.notePlaceholder")}
						rows={3}
						maxLength={MAX_NOTE_LENGTH}
						className='input resize-y'
					/>
				</label>

				{error ? <p className='text-sm text-rose-600 dark:text-rose-400'>{error}</p> : null}
			</div>
		</Modal>
	)
}
