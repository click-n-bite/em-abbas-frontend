"use client"

import { useEffect, useMemo, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import { PhoneInput } from "@/components/phone-input"
import { useI18n } from "@/providers/i18n-provider"
import { parsePhone, type CountryCode } from "@/lib/countries"
import type { NotifyPhone } from "@/lib/types"
import type { CreateNotifyPhonePayload, UpdateNotifyPhonePayload } from "@/lib/api"

interface Props {
	open: boolean
	entry: NotifyPhone | null
	onClose: () => void
	onSubmit: (payload: CreateNotifyPhonePayload | UpdateNotifyPhonePayload) => Promise<void>
}

function seedFromExisting(entry: NotifyPhone | null): { country: CountryCode | null; national: string } {
	if (!entry) return { country: "LB", national: "" }

	const parsed = parsePhone(`+${entry.phoneNumber}`)

	return { country: parsed.country ?? "LB", national: parsed.national || entry.phoneNumber }
}

export function NotifyPhoneFormModal({ open, entry, onClose, onSubmit }: Props) {
	const { t } = useI18n()

	const [name, setName] = useState("")

	const [country, setCountry] = useState<CountryCode | null>("LB")

	const [national, setNational] = useState("")

	const [enabled, setEnabled] = useState(true)

	const [busy, setBusy] = useState(false)

	const [touched, setTouched] = useState(false)

	useEffect(() => {
		if (!open) return

		const seed = seedFromExisting(entry)

		setName(entry?.name ?? "")
		setCountry(seed.country)
		setNational(seed.national)
		setEnabled(entry?.notificationsEnabled ?? true)
		setTouched(false)
		setBusy(false)
	}, [open, entry])

	const parsed = useMemo(() => (country ? parsePhone(national, country) : null), [country, national])

	const nameValid = name.trim().length > 0
	const phoneValid = Boolean(parsed?.valid && parsed.e164)
	const valid = nameValid && phoneValid

	const submit = async () => {
		setTouched(true)

		if (!valid || !parsed?.e164 || busy) return

		setBusy(true)

		try {
			await onSubmit({
				name: name.trim(),
				phoneNumber: parsed.e164,
				notificationsEnabled: enabled
			})
		} finally {
			setBusy(false)
		}
	}

	return (
		<Modal
			open={open}
			title={entry ? t("notifyPhones.editTitle") : t("notifyPhones.addTitle")}
			onClose={busy ? () => undefined : onClose}
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={busy}>
						{t("common.cancel")}
					</button>
					<button type='button' className='btn-primary' onClick={() => void submit()} disabled={busy}>
						{busy ? <Spinner /> : null}
						{busy ? t("common.saving") : t("common.save")}
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
					<label className='label' htmlFor='notify-name'>
						{t("notifyPhones.name")}
					</label>
					<input
						id='notify-name'
						className='input'
						value={name}
						onChange={(event) => setName(event.target.value)}
						aria-invalid={touched && !nameValid}
						autoComplete='off'
						required
					/>
				</div>

				<PhoneInput
					label={t("notifyPhones.phone")}
					required
					country={country}
					national={national}
					onCountryChange={setCountry}
					onNationalChange={setNational}
				/>

				<label className='flex items-center gap-3 text-sm text-ink-700 dark:text-ink-200'>
					<input
						type='checkbox'
						checked={enabled}
						onChange={(event) => setEnabled(event.target.checked)}
						className='h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500'
					/>
					{t("notifyPhones.notificationsEnabled")}
				</label>

				{touched && !valid ? (
					<p className='text-xs text-rose-600 dark:text-rose-400'>
						{!nameValid ? t("notifyPhones.nameRequired") : t("phone.invalid")}
					</p>
				) : null}

				<button type='submit' className='sr-only'>
					{t("common.save")}
				</button>
			</form>
		</Modal>
	)
}
