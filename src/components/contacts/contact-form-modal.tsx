"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { contactsApi } from "@/lib/features/contacts/api"
import { contactErrorKey, formatContactPhone, isValidContactPhone } from "@/lib/features/contacts/format"
import type { Contact, ContactInput, ContactWarning } from "@/lib/features/contacts/types"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { Spinner } from "@/components/ui/spinner"

const MAX_PHONES = 20

interface PhoneRow {
	phone: string
	label: string
}

interface Props {
	open: boolean
	contact: Contact | null
	onClose: () => void
	onSaved: (contact: Contact) => void
}

export function ContactFormModal({ open, contact, onClose, onSaved }: Props) {
	const { t } = useI18n()

	const { canManageUsers } = useAuth()

	const [name, setName] = useState("")

	const [notes, setNotes] = useState("")

	const [phones, setPhones] = useState<PhoneRow[]>([])

	const [trusted, setTrusted] = useState(false)

	const [reason, setReason] = useState("")

	const [saving, setSaving] = useState(false)

	const [error, setError] = useState<string | null>(null)

	const [saved, setSaved] = useState<Contact | null>(null)

	useEffect(() => {
		if (!open) return

		setName(contact?.displayName ?? "")
		setNotes(contact?.notes ?? "")
		setPhones(
			(contact?.phones ?? []).map((p) => ({
				phone: formatContactPhone(p.phone),
				label: p.label ?? ""
			}))
		)
		setTrusted(contact?.trusted ?? false)
		setReason("")
		setError(null)
		setSaved(null)
	}, [open, contact])

	if (!open) return null

	const warnings: ContactWarning[] = saved?.warnings ?? []

	const finish = (result: Contact) => {
		onSaved(result)
		onClose()
	}

	const updatePhone = (index: number, patch: Partial<PhoneRow>) =>
		setPhones((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

	const submit = async () => {
		if (saving) return

		const cleanName = name.trim()

		if (!cleanName) {
			setError(t("contacts.errors.nameRequired"))

			return
		}

		const filled = phones.filter((row) => row.phone.trim() !== "")

		if (filled.some((row) => !isValidContactPhone(row.phone))) {
			setError(t("contacts.errors.invalidPhone"))

			return
		}

		const input: ContactInput = {
			displayName: cleanName,
			...(contact ? { notes: notes.trim() } : notes.trim() ? { notes: notes.trim() } : {}),
			phones: filled.map((row) => ({
				phone: row.phone.trim(),
				label: row.label.trim() || null
			}))
		}

		if (canManageUsers && trusted !== (contact?.trusted ?? false)) {
			input.trusted = trusted

			if (reason.trim()) input.trustedReason = reason.trim()
		}

		setSaving(true)
		setError(null)

		try {
			const result = contact ? await contactsApi.update(contact.id, input) : await contactsApi.create(input)

			// A phone already on another contact is a notice, not an error.
			if (result.warnings && result.warnings.length > 0) {
				setSaved(result)
				onSaved(result)
			} else {
				finish(result)
			}
		} catch (err) {
			const key = contactErrorKey(err)

			setError(key ? t(key) : (errorDetail(err) ?? t(errorKey(err))))
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
				className='flex max-h-[90dvh] w-full max-w-lg flex-col rounded-2xl border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-800'>
				<h3 className='border-b border-ink-200 px-5 py-3 text-sm font-semibold text-ink-900 dark:border-ink-700 dark:text-ink-50'>
					{contact ? t("contacts.form.editTitle") : t("contacts.form.createTitle")}
				</h3>

				{saved ? (
					<div className='space-y-3 overflow-y-auto p-5'>
						<p className='text-sm text-ink-700 dark:text-ink-200'>{t("contacts.saved")}</p>

						{warnings.map((warning) => (
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
						<div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-5'>
							<label className='block text-xs font-medium text-ink-600 dark:text-ink-300'>
								{t("contacts.form.name")}
								<input
									autoFocus
									value={name}
									maxLength={255}
									onChange={(event) => setName(event.target.value)}
									className='input mt-1 w-full'
								/>
							</label>

							<div>
								<p className='mb-1 text-xs font-medium text-ink-600 dark:text-ink-300'>{t("contacts.form.phones")}</p>

								<div className='space-y-2'>
									{phones.map((row, index) => (
										<div key={index} className='flex items-center gap-2'>
											<input
												dir='ltr'
												inputMode='tel'
												value={row.phone}
												onChange={(event) => updatePhone(index, { phone: event.target.value })}
												placeholder={t("contacts.form.phoneNumber")}
												aria-label={t("contacts.form.phoneNumber")}
												className='input min-w-0 flex-[1.4]'
											/>
											<input
												value={row.label}
												maxLength={50}
												onChange={(event) => updatePhone(index, { label: event.target.value })}
												placeholder={t("contacts.form.phoneLabel")}
												aria-label={t("contacts.form.phoneLabel")}
												className='input min-w-0 flex-1'
											/>
											<button
												type='button'
												className='btn-ghost h-9 w-9 shrink-0 p-0 text-rose-600 dark:text-rose-300'
												onClick={() => setPhones((rows) => rows.filter((_, i) => i !== index))}
												aria-label={t("contacts.form.removePhone")}
												title={t("contacts.form.removePhone")}>
												<Trash2 className='h-4 w-4' aria-hidden='true' />
											</button>
										</div>
									))}
								</div>

								{phones.length < MAX_PHONES ? (
									<button
										type='button'
										className='btn-ghost mt-2 px-2 py-1 text-xs'
										onClick={() => setPhones((rows) => [...rows, { phone: "", label: "" }])}>
										<Plus className='h-3.5 w-3.5' aria-hidden='true' />
										{t("contacts.form.addPhone")}
									</button>
								) : null}
							</div>

							<label className='block text-xs font-medium text-ink-600 dark:text-ink-300'>
								{t("contacts.form.notes")}
								<textarea
									value={notes}
									maxLength={4000}
									rows={3}
									onChange={(event) => setNotes(event.target.value)}
									className='input mt-1 w-full resize-y'
								/>
							</label>

							{canManageUsers ? (
								<div className='rounded-xl border border-ink-200 p-3 dark:border-ink-700'>
									<label className='flex items-center gap-2 text-sm text-ink-800 dark:text-ink-100'>
										<input
											type='checkbox'
											checked={trusted}
											onChange={(event) => setTrusted(event.target.checked)}
											className='h-4 w-4'
										/>
										{t("contacts.form.trusted")}
									</label>

									{trusted !== (contact?.trusted ?? false) ? (
										<input
											value={reason}
											onChange={(event) => setReason(event.target.value)}
											placeholder={t("contacts.form.trustedReason")}
											aria-label={t("contacts.form.trustedReason")}
											className='input mt-2 w-full'
										/>
									) : null}
								</div>
							) : null}

							{error ? (
								<p role='alert' className='text-xs text-rose-600 dark:text-rose-300'>
									{error}
								</p>
							) : null}
						</div>

						<div className='flex justify-end gap-2 border-t border-ink-200 px-5 py-3 dark:border-ink-700'>
							<button type='button' className='btn-secondary px-3 py-1.5 text-xs' onClick={onClose} disabled={saving}>
								{t("common.cancel")}
							</button>
							<button
								type='button'
								className='btn-primary px-3 py-1.5 text-xs'
								onClick={() => void submit()}
								disabled={saving || name.trim() === ""}>
								{saving ? <Spinner /> : null}
								{t("common.save")}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
