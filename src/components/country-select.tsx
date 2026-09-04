"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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

	const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

	const rootRef = useRef<HTMLDivElement>(null)

	const triggerRef = useRef<HTMLButtonElement>(null)

	const panelRef = useRef<HTMLDivElement>(null)

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

	const place = () => {
		const rect = triggerRef.current?.getBoundingClientRect()

		if (!rect) return

		const panelWidth = 320

		const viewportWidth = window.innerWidth

		const left =
			rect.left + panelWidth > viewportWidth - 12
				? Math.max(12, rect.right - panelWidth)
				: rect.left

		setCoords({ top: rect.bottom + 8, left, width: rect.width })
	}

	useLayoutEffect(() => {
		if (!open) return

		place()
	}, [open])

	useEffect(() => {
		if (!open) return

		const onPointerDown = (event: MouseEvent) => {
			const target = event.target as Node

			if (rootRef.current?.contains(target)) return
			if (panelRef.current?.contains(target)) return

			setOpen(false)
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false)
		}

		const onReposition = () => place()

		document.addEventListener("mousedown", onPointerDown)
		document.addEventListener("keydown", onKeyDown)
		window.addEventListener("scroll", onReposition, true)
		window.addEventListener("resize", onReposition)
		searchRef.current?.focus()

		return () => {
			document.removeEventListener("mousedown", onPointerDown)
			document.removeEventListener("keydown", onKeyDown)
			window.removeEventListener("scroll", onReposition, true)
			window.removeEventListener("resize", onReposition)
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
				ref={triggerRef}
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
						<ChevronDown
							className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
							aria-hidden='true'
						/>
					</span>
				)}
			</button>

			{open && coords
				? createPortal(
						<div
							ref={panelRef}
							style={{ top: coords.top, left: coords.left }}
							className='fixed z-[999] w-80 max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-ink-100 bg-white p-2 shadow-2xl shadow-ink-900/10 dark:border-ink-700 dark:bg-ink-800'>
							<div className='flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5 dark:bg-ink-700/60'>
								<Search className='h-4 w-4 shrink-0 text-ink-400' aria-hidden='true' />
								<input
									ref={searchRef}
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder={t("phone.searchCountry")}
									aria-label={t("phone.searchCountry")}
									style={{ boxShadow: "none" }}
									className='w-full appearance-none border-0 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none dark:text-ink-100'
								/>
							</div>

							<ul role='listbox' className='mt-2 max-h-64 space-y-0.5 overflow-y-auto pe-1'>
								{results.length === 0 ? (
									<li className='px-3 py-8 text-center text-sm text-ink-400'>{t("phone.noMatch")}</li>
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
														"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition",
														isDisabled
															? "cursor-not-allowed text-ink-300 dark:text-ink-600"
															: "hover:bg-ink-100 dark:hover:bg-ink-700/70",
														isSelected &&
															"bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
													)}>
													<span
														aria-hidden='true'
														className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-base leading-none dark:bg-ink-700'>
														{country.flag}
													</span>
													<span className='flex-1 truncate'>{country.name}</span>
													<span className='tabular-nums text-xs text-ink-400' dir='ltr'>
														+{country.callingCode}
													</span>
													{isSelected ? (
														<Check className='h-4 w-4 shrink-0 text-brand-600' aria-hidden='true' />
													) : null}
												</button>
											</li>
										)
									})
								)}
							</ul>
						</div>,
						document.body
				  )
				: null}
		</div>
	)
}