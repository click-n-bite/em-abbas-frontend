"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { countryList, type Country, type CountryCode } from "@/lib/countries"
import { useI18n } from "@/providers/i18n-provider"
import { cn } from "@/lib/utils"

interface Props {
	value: CountryCode | null
	onChange: (code: CountryCode) => void
	disabledCodes?: string[]
	compact?: boolean
	id?: string
	className?: string
}

export function CountrySelect({ value, onChange, disabledCodes = [], compact = false, id, className }: Props) {
	const { t, locale } = useI18n()

	const [open, setOpen] = useState(false)

	const [query, setQuery] = useState("")

	const rootRef = useRef<HTMLDivElement>(null)

	const searchRef = useRef<HTMLInputElement>(null)

	const countries = useMemo(() => countryList(locale), [locale])

	const selected = useMemo(() => countries.find((country) => country.code === value) ?? null, [countries, value])

	const results = useMemo(() => {
		const needle = query.trim().toLowerCase().replace(/^\+/, "")

		if (!needle) return countries

		return countries.filter(
			(country) =>
				country.name.toLowerCase().includes(needle) ||
				country.code.toLowerCase().includes(needle) ||
				country.callingCode.startsWith(needle)
		)
	}, [countries, query])

	useEffect(() => {
		if (!open) return

		const onPointerDown = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false)
		}

		document.addEventListener("mousedown", onPointerDown)
		document.addEventListener("keydown", onKeyDown)
		searchRef.current?.focus()

		return () => {
			document.removeEventListener("mousedown", onPointerDown)
			document.removeEventListener("keydown", onKeyDown)
		}
	}, [open])

	const pick = (country: Country) => {
		onChange(country.code)
		setOpen(false)
		setQuery("")
	}

	return (
		<div ref={rootRef} className={cn("relative", className)}>
			<button
				id={id}
				type='button'
				aria-haspopup='listbox'
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}
				className={cn(
					"flex items-center gap-2 text-sm transition",
					compact
						? "h-full rounded-s-xl border-e border-ink-200 px-3 text-ink-700 hover:bg-ink-100 dark:border-ink-600 dark:text-ink-200 dark:hover:bg-ink-700"
						: "input justify-between"
				)}>
				<span className='flex items-center gap-2 truncate'>
					<span aria-hidden='true' className='text-base leading-none'>
						{selected?.flag ?? "\u{1F30D}"}
					</span>
					{compact ? (
						<span className='tabular-nums' dir='ltr'>
							{selected ? `+${selected.callingCode}` : "+"}
						</span>
					) : (
						<span className='truncate'>{selected?.name ?? t("phone.selectCountry")}</span>
					)}
				</span>
				{compact ? null : (
					<span className='flex items-center gap-2 text-ink-400'>
						{selected ? (
							<span className='tabular-nums' dir='ltr'>
								+{selected.callingCode}
							</span>
						) : null}
						<ChevronDown className='h-4 w-4' aria-hidden='true' />
					</span>
				)}
			</button>

			{open ? (
				<div className='absolute z-40 mt-2 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl dark:border-ink-600 dark:bg-ink-800'>
					<div className='flex items-center gap-2 border-b border-ink-200 px-3 py-2 dark:border-ink-700'>
						<Search className='h-4 w-4 text-ink-400' aria-hidden='true' />
						<input
							ref={searchRef}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("phone.searchCountry")}
							aria-label={t("phone.searchCountry")}
							className='w-full bg-transparent text-sm outline-none placeholder:text-ink-400'
						/>
					</div>

					<ul role='listbox' className='max-h-64 overflow-y-auto py-1'>
						{results.length === 0 ? (
							<li className='px-3 py-6 text-center text-sm text-ink-500'>{t("phone.noMatch")}</li>
						) : (
							results.map((country) => {
								const isDisabled = disabledCodes.includes(country.code)

								const isSelected = country.code === value

								return (
									<li key={country.code}>
										<button
											type='button'
											role='option'
											aria-selected={isSelected}
											disabled={isDisabled}
											onClick={() => pick(country)}
											className={cn(
												"flex w-full items-center gap-3 px-3 py-2 text-start text-sm transition",
												isDisabled
													? "cursor-not-allowed text-ink-300 dark:text-ink-600"
													: "hover:bg-ink-100 dark:hover:bg-ink-700",
												isSelected && "bg-brand-50 dark:bg-brand-900/30"
											)}>
											<span aria-hidden='true' className='text-base leading-none'>
												{country.flag}
											</span>
											<span className='flex-1 truncate'>{country.name}</span>
											<span className='tabular-nums text-ink-400' dir='ltr'>
												+{country.callingCode}
											</span>
											{isSelected ? <Check className='h-4 w-4 text-brand-600' aria-hidden='true' /> : null}
										</button>
									</li>
								)
							})
						)}
					</ul>
				</div>
			) : null}
		</div>
	)
}
