"use client"

import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import { useI18n } from "@/providers/i18n-provider"
import type { UpdateLeadPayload } from "@/lib/api"
import { Lead } from "@/lib/features/leads/types"

interface Props {
	lead: Lead | null
	onClose: () => void
	onSubmit: (id: number, payload: UpdateLeadPayload) => Promise<void>
}

export function LeadStatusModal({ lead, onClose, onSubmit }: Props) {
	const { t, formatDateTime } = useI18n()

	const [note, setNote] = useState("")

	const [closeNote, setCloseNote] = useState("")

	const [busy, setBusy] = useState<"save" | "toggle" | null>(null)

	const [touched, setTouched] = useState(false)

	useEffect(() => {
		if (!lead) return

		setNote(lead.note ?? "")
		setCloseNote(lead.closeNote ?? "")
		setBusy(null)
		setTouched(false)
	}, [lead])

	if (!lead) return null

	const noteChanged = note.trim() !== (lead.note ?? "").trim()

	const closeNoteChanged = closeNote.trim() !== (lead.closeNote ?? "").trim()

	const saveChanges = async () => {
		const payload: UpdateLeadPayload = {}

		if (noteChanged) payload.note = note.trim()

		if (lead.status === "closed" && closeNoteChanged) payload.closeNote = closeNote.trim()

		if (Object.keys(payload).length === 0) return

		setBusy("save")

		try {
			await onSubmit(lead.id, payload)
		} finally {
			setBusy(null)
		}
	}

	const closeLead = async () => {
		setTouched(true)

		if (!closeNote.trim() || busy) return

		setBusy("toggle")

		try {
			const payload: UpdateLeadPayload = { status: "closed", closeNote: closeNote.trim() }

			if (noteChanged) payload.note = note.trim()

			await onSubmit(lead.id, payload)
		} finally {
			setBusy(null)
		}
	}

	const reopenLead = async () => {
		if (busy) return

		setBusy("toggle")

		try {
			await onSubmit(lead.id, { status: "open" })
		} finally {
			setBusy(null)
		}
	}

	const isOpen = lead.status === "open"

	return (
		<Modal
			open={Boolean(lead)}
			title={isOpen ? t("leads.closeLeadTitle") : t("leads.reopenLeadTitle")}
			description={isOpen ? t("leads.closeLeadSubtitle") : t("leads.reopenLeadSubtitle")}
			onClose={busy ? () => undefined : onClose}
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={Boolean(busy)}>
						{t("common.cancel")}
					</button>

					<button
						type='button'
						className='btn-secondary'
						onClick={() => void saveChanges()}
						disabled={Boolean(busy) || (!noteChanged && !(lead.status === "closed" && closeNoteChanged))}>
						{busy === "save" ? <Spinner /> : null}
						{busy === "save" ? t("leads.saving") : t("leads.save")}
					</button>

					{isOpen ? (
						<button type='button' className='btn-danger' onClick={() => void closeLead()} disabled={Boolean(busy)}>
							{busy === "toggle" ? <Spinner /> : null}
							{t("leads.closeLead")}
						</button>
					) : (
						<button type='button' className='btn-primary' onClick={() => void reopenLead()} disabled={Boolean(busy)}>
							{busy === "toggle" ? <Spinner /> : null}
							{t("leads.openLead")}
						</button>
					)}
				</>
			}>
			<div className='space-y-4'>
				<div className='rounded-xl border border-ink-200 px-3 py-2 text-sm dark:border-ink-700'>
					<p className='font-medium text-ink-900 dark:text-ink-50'>{lead.customerName || `+${lead.phone}`}</p>
					<p className='text-xs text-ink-500 dark:text-ink-400'>{lead.serviceName}</p>
				</div>

				<div>
					<label className='label' htmlFor='lead-status-note'>
						{t("leads.note")} <span className='text-ink-400'>({t("common.optional")})</span>
					</label>
					<textarea
						id='lead-status-note'
						rows={2}
						className='input resize-y py-2.5'
						value={note}
						onChange={(event) => setNote(event.target.value)}
						maxLength={500}
					/>
				</div>

				{isOpen ? (
					<div>
						<label className='label' htmlFor='lead-close-note'>
							{t("leads.closeNote")}
						</label>
						<textarea
							id='lead-close-note'
							rows={2}
							className='input resize-y py-2.5'
							value={closeNote}
							onChange={(event) => setCloseNote(event.target.value)}
							placeholder={t("leads.closeNotePlaceholder")}
							maxLength={500}
						/>
						{touched && !closeNote.trim() ? (
							<p className='mt-1 text-xs text-rose-600 dark:text-rose-400'>{t("leads.closeNoteRequired")}</p>
						) : null}
					</div>
				) : (
					<div>
						<label className='label' htmlFor='lead-close-note'>
							{t("leads.closeNote")}
						</label>
						<textarea
							id='lead-close-note'
							rows={2}
							className='input resize-y py-2.5'
							value={closeNote}
							onChange={(event) => setCloseNote(event.target.value)}
							maxLength={500}
						/>
						{lead.closedBy || lead.closedAt ? (
							<p className='mt-1.5 text-xs text-ink-500 dark:text-ink-400'>
								{t("leads.closedBy")}: {lead.closedBy?.displayName ?? t("common.unknown")}
								{lead.closedAt ? ` \u00b7 ${formatDateTime(lead.closedAt)}` : null}
							</p>
						) : null}
					</div>
				)}
			</div>
		</Modal>
	)
}
