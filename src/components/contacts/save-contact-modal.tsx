"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { contactsApi } from "@/lib/features/contacts/api"
import { contactErrorKey, errorCodeOf, errorDataOf, formatContactPhone } from "@/lib/features/contacts/format"
import type { Contact } from "@/lib/features/contacts/types"
import { errorDetail, errorKey } from "@/lib/errors"
import { useI18n } from "@/providers/i18n-provider"
import { Spinner } from "@/components/ui/spinner"

interface Props {
	open: boolean
	conversationId: string
	defaultName: string
	onClose: () => void
	onSaved: (contact: Contact) => void
}

export function SaveContactModal({ open, conversationId, defaultName, onClose, onSaved }: Props) {
	const { t } = useI18n()

	const [name, setName] = useState("")

	const [notes, setNotes] = useState("")

	const [saving, setSaving] = useState(false)

	const [error, setError] = useState<string | null>(null)

	const [owner, setOwner] = useState<{ id: number; name: string } | null>(null)

	const [saved, setSaved] = useState<Contact | null>(null)

	useEffect(() => {
		if (!open) return

		setName(defaultName)
		setNotes("")
		setError(null)
		setOwner(null)
		setSaved(null)
	}, [open, defaultName])

	if (!open) return null

	const finish = (contact: Contact) => {
		onSaved(contact)
		onClose()
	}

	const submit = async () => {
		if (saving) return

		setSaving(true)
		setError(null)
		setOwner(null)

		try {
			const result = await contactsApi.fromConversation(conversationId, {
				...(name.trim() ? { displayName: name.trim() } : {}),
				...(notes.trim() ? { notes: notes.trim() } : {})
			})

			if (result.warnings && result.warnings.length > 0) {
				setSaved(result)
				onSaved(result)
			} else {
				finish(result)
			}
		} catch (err) {
			const code = errorCodeOf(err)

			if (code === "CUSTOMER_ALREADY_LINKED") {
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
			setSaving(false)
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
				className='w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-5 shadow-xl dark:border-ink-700 dark:bg-ink-800'>
				<h3 className='mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50'>
					{t("contacts.saveAsContact.title")}
				</h3>
				<p className='mb-4 text-xs text-ink-500 dark:text-ink-400'>{t("contacts.saveAsContact.hint")}</p>

				{saved ? (
					<div className='space-y-3'>
						{saved.warnings.map((warning) => (
							<p
								key={`${warning.contactId}-${warning.phone}`}
								role='status'
								className='rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100'>
								{t("contacts.warnings.phoneOnOther", {
									name: warning.contactName,
									phone: formatContactPhone(warning.phone)
								})}
							</p>
						))}
						<div className='flex justify-end'>
							<button type='button' className='btn-primary px-4 py-1.5 text-xs' onClick={() => finish(saved)}>
								{t("common.close")}
							</button>
						</div>
					</div>
				) : (
					<>
						<label className='mb-3 block text-xs font-medium text-ink-600 dark:text-ink-300'>
							{t("contacts.form.name")}
							<input
								autoFocus
								value={name}
								maxLength={255}
								onChange={(event) => setName(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") void submit()
								}}
								className='input mt-1 w-full'
							/>
						</label>

						<label className='mb-3 block text-xs font-medium text-ink-600 dark:text-ink-300'>
							{t("contacts.form.notes")}
							<textarea
								value={notes}
								maxLength={4000}
								rows={2}
								onChange={(event) => setNotes(event.target.value)}
								className='input mt-1 w-full resize-y'
							/>
						</label>

						{owner ? (
							<div
								role='alert'
								className='mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100'>
								<span>{t("contacts.errors.alreadyLinked", { name: owner.name })}</span>
								<Link href={`/contacts/${owner.id}`} className='font-semibold underline' onClick={onClose}>
									{t("contacts.openContact")}
								</Link>
							</div>
						) : null}

						{error ? (
							<p role='alert' className='mb-3 text-xs text-rose-600 dark:text-rose-300'>
								{error}
							</p>
						) : null}

						<div className='flex justify-end gap-2'>
							<button type='button' className='btn-secondary px-3 py-1.5 text-xs' onClick={onClose} disabled={saving}>
								{t("common.cancel")}
							</button>
							<button
								type='button'
								className='btn-primary px-3 py-1.5 text-xs'
								onClick={() => void submit()}
								disabled={saving}>
								{saving ? <Spinner /> : null}
								{t("contacts.saveAsContact.action")}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
