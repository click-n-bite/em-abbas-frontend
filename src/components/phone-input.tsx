"use client"

import { useId } from "react"
import { CountrySelect } from "./country-select"
import { formatAsYouType, parsePhone, type CountryCode } from "@/lib/countries"
import { useI18n } from "@/providers/i18n-provider"

interface Props {
	country: CountryCode | null
	national: string
	onCountryChange: (code: CountryCode) => void
	onNationalChange: (value: string) => void
	label?: string
	hint?: string
	required?: boolean
}

export function PhoneInput({ country, national, onCountryChange, onNationalChange, label, hint, required }: Props) {
	const { t } = useI18n()

	const id = useId()

	const parsed = country ? parsePhone(national, country) : null

	const showError = Boolean(national.trim()) && parsed !== null && !parsed.valid

	return (
		<div>
			{label ? (
				<label className='label' htmlFor={id}>
					{label}
					{required ? <span className='text-rose-500'> *</span> : null}
				</label>
			) : null}

			<div className='flex items-stretch overflow-hidden rounded-xl border border-ink-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200 dark:border-ink-600 dark:bg-ink-900 dark:focus-within:ring-brand-900'>
				<CountrySelect compact value={country} onChange={onCountryChange} />
				<input
					id={id}
					type='tel'
					inputMode='tel'
					dir='ltr'
					value={national}
					onChange={(event) =>
						onNationalChange(
							country ? formatAsYouType(event.target.value, country) : event.target.value.replace(/[^\d+\s()-]/g, "")
						)
					}
					placeholder='5X XXX XXXX'
					aria-invalid={showError}
					className='w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-400 dark:placeholder:text-ink-500'
				/>
			</div>

			{showError ? (
				<p className='mt-1.5 text-xs text-rose-600 dark:text-rose-400'>{t("phone.invalid")}</p>
			) : hint ? (
				<p className='mt-1.5 text-xs text-ink-500 dark:text-ink-400'>{hint}</p>
			) : parsed?.e164 ? (
				<p className='mt-1.5 text-xs text-ink-500 dark:text-ink-400' dir='ltr'>
					{parsed.e164}
				</p>
			) : null}
		</div>
	)
}
