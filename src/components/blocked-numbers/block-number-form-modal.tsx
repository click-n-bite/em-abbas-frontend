"use client"

import { useEffect, useMemo, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Spinner } from "@/components/ui/spinner"
import { PhoneInput } from "@/components/phone-input"
import { useI18n } from "@/providers/i18n-provider"
import { parsePhone, type CountryCode } from "@/lib/countries"
import type { BlockNumberPayload } from "@/lib/api"

interface Props {
	open: boolean
	/** Prefill (e.g. "Block this contact" from an open chat). Full E.164 number, digits after "+". */
	initialPhone?: string | null
	onClose: () => void
	onSubmit: (payload: BlockNumberPayload) => Promise<void>
}

function seedFromInitial(initialPhone?: string | null): { country: CountryCode | null; national: string } {
	if (!initialPhone) return { country: "LB", national: "" }

	const parsed = parsePhone(initialPhone.startsWith("+") ? initialPhone : `+${initialPhone}`)

	return { country: parsed.country ?? "LB", national: parsed.national || initialPhone }
}

export function BlockNumberFormModal({ open, initialPhone, onClose, onSubmit }: Props) {
	const { t } = useI18n()

	const [country, setCountry] = useState<CountryCode | null>("LB")

	const [national, setNational] = useState("")

	const [reason, setReason] = useState("")

	const [busy, setBusy] = useState(false)

	const [touched, setTouched] = useState(false)

	useEffect(() => {
		if (!open) return

		const seed = seedFromInitial(initialPhone)

		setCountry(seed.country)
		setNational(seed.national)
		setReason("")
		setTouched(false)
		setBusy(false)
	}, [open, initialPhone])

	const parsed = useMemo(() => (country ? parsePhone(national, country) : null), [country, national])

	const phoneValid = Boolean(parsed?.valid && parsed.e164)

	const submit = async () => {
		setTouched(true)

		if (!phoneValid || !parsed?.e164 || busy) return

		setBusy(true)

		try {
			await onSubmit({
				phone: parsed.e164,
				reason: reason.trim() || undefined
			})
		} finally {
			setBusy(false)
		}
	}

	return (
		<Modal
			open={open}
			title={t("blockedNumbers.addTitle")}
			description={t("blockedNumbers.addSubtitle")}
			onClose={busy ? () => undefined : onClose}
			footer={
				<>
					<button type='button' className='btn-secondary' onClick={onClose} disabled={busy}>
						{t("common.cancel")}
					</button>
					<button type='button' className='btn-danger' onClick={() => void submit()} disabled={busy}>
						{busy ? <Spinner /> : null}
						{busy ? t("blockedNumbers.blocking") : t("blockedNumbers.block")}
					</button>
				</>
			}>
			<form
				className='space-y-4'
				onSubmit={(event) => {
					event.preventDefault()
					void submit()
				}}>
				<PhoneInput
					label={t("blockedNumbers.phone")}
					required
					country={country}
					national={national}
					onCountryChange={setCountry}
					onNationalChange={setNational}
				/>

				<div>
					<label className='label' htmlFor='block-number-reason'>
						{t("blockedNumbers.reason")}
						<span className='text-ink-400'> ({t("common.optional")})</span>
					</label>
					<input
						id='block-number-reason'
						className='input'
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						placeholder={t("blockedNumbers.reasonPlaceholder")}
						maxLength={255}
						autoComplete='off'
					/>
				</div>

				{touched && !phoneValid ? (
					<p className='text-xs text-rose-600 dark:text-rose-400'>{t("phone.invalid")}</p>
				) : null}

				<button type='submit' className='sr-only'>
					{t("blockedNumbers.block")}
				</button>
			</form>
		</Modal>
	)
}
