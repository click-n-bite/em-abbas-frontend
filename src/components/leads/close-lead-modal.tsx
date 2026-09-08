"use client"

import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import { useI18n } from "@/providers/i18n-provider"
import type { Lead } from "@/lib/types"
import { MAX_NOTE_LENGTH } from "@/lib/config"

interface Props {
	lead: Lead | null
	onClose: () => void
	onSubmit: (closeNote: string) => Promise<void>
}

export function CloseLeadModal({ lead, onClose, onSubmit }: Props) {
	const { t } = useI18n()

	const [closeNote, setCloseNote] = useState("")

	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		setCloseNote(lead?.closeNote ?? "")
	}, [lead])

	const submit = async () => {
		if (submitting) return

		setSubmitting(true)

		try {
			await onSubmit(closeNote.trim())
			onClose()
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<Modal
			open={lead !== null}
			title={t("leads.closeTitle")}
			description={t("leads.closeSubtitle")}
			onClose={submitting ? () => undefined : onClose}
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={submitting}>
						{t("common.cancel")}
					</button>
					<button type='button' className='btn-danger' onClick={() => void submit()} disabled={submitting}>
						{submitting ? <Spinner /> : null}
						{submitting ? t("leads.closing") : t("leads.confirmClose")}
					</button>
				</>
			}>
			<label className='block'>
				<span className='mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200'>{t("leads.closeNote")}</span>
				<textarea
					value={closeNote}
					onChange={(event) => setCloseNote(event.target.value)}
					placeholder={t("leads.closeNotePlaceholder")}
					rows={3}
					autoFocus
					maxLength={MAX_NOTE_LENGTH}
					className='input resize-y'
				/>
			</label>
		</Modal>
	)
}
