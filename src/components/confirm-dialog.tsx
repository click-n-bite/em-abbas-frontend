"use client"

import { useState } from "react"
import { Modal } from "./ui/modal"
import { Spinner } from "./ui/spinner"
import { useI18n } from "@/providers/i18n-provider"

interface Props {
	open: boolean
	title: string
	body?: string
	confirmLabel?: string
	tone?: "danger" | "primary"
	onConfirm: () => Promise<void> | void
	onClose: () => void
}

export function ConfirmDialog({ open, title, body, confirmLabel, tone = "danger", onConfirm, onClose }: Props) {
	const { t } = useI18n()

	const [busy, setBusy] = useState(false)

	const run = async () => {
		setBusy(true)

		try {
			await onConfirm()
			onClose()
		} finally {
			setBusy(false)
		}
	}

	return (
		<Modal
			open={open}
			title={title}
			onClose={busy ? () => undefined : onClose}
			size='sm'
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={busy}>
						{t("common.cancel")}
					</button>
					<button
						type='button'
						className={tone === "danger" ? "btn-danger" : "btn-primary"}
						onClick={run}
						disabled={busy}>
						{busy ? <Spinner /> : null}
						{confirmLabel ?? t("common.confirm")}
					</button>
				</>
			}>
			<p className='text-sm text-ink-600 dark:text-ink-300'>{body}</p>
		</Modal>
	)
}
