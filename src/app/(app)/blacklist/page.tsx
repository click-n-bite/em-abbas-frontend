"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Ban, CheckCircle2, RefreshCw, ShieldAlert, Trash2, XCircle } from "lucide-react"
import { adminApi } from "@/lib/api"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { CountrySelect } from "@/components/country-select"
import { PhoneInput } from "@/components/phone-input"
import {
	callingCodeOf,
	countryForCallingCode,
	countryName,
	evaluateNumber,
	flagOf,
	type CountryCode
} from "@/lib/countries"
import { cn } from "@/lib/utils"
import type { BlockedCountry } from "@/lib/types"

export default function BlacklistPage() {
	const { t, locale, formatDateTime } = useI18n()

	const { role, canManageUsers } = useAuth()

	const { push } = useToast()

	const [entries, setEntries] = useState<BlockedCountry[]>([])

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [country, setCountry] = useState<CountryCode | null>("SA")

	const [busy, setBusy] = useState(false)

	const [pendingRemove, setPendingRemove] = useState<BlockedCountry | null>(null)

	const [testCountry, setTestCountry] = useState<CountryCode | null>("SA")

	const [testNumber, setTestNumber] = useState("")

	const load = useCallback(async () => {
		try {
			const list = await adminApi.listBlockedCountries()

			setEntries(list)
			setFailure(null)
		} catch (error) {
			setFailure(errorKey(error))
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	// The API only gives us a calling code, so the ISO code (used for flags
	// and disabling an already-blocked country in the picker) is a best guess.
	const codeOf = useCallback((entry: BlockedCountry) => countryForCallingCode(entry.callingCode), [])

	const blockedCodes = useMemo(
		() => entries.map((entry) => codeOf(entry)).filter((code): code is CountryCode => Boolean(code)),
		[entries, codeOf]
	)

	const blockedCallingCodes = useMemo(() => entries.map((entry) => entry.callingCode), [entries])

	const sorted = useMemo(() => {
		const collator = new Intl.Collator(locale === "ar" ? "ar" : "en")

		const nameOf = (entry: BlockedCountry) => (locale === "ar" ? entry.nameAr : entry.nameEn)

		return [...entries].sort((a, b) => collator.compare(nameOf(a), nameOf(b)))
	}, [entries, locale])

	const verdict = useMemo(() => {
		if (!testNumber.trim()) return null

		return evaluateNumber(testNumber, blockedCodes, blockedCallingCodes, testCountry ?? undefined)
	}, [testNumber, blockedCodes, blockedCallingCodes, testCountry])

	const block = async () => {
		if (!country || busy) return

		const callingCode = callingCodeOf(country)

		if (blockedCallingCodes.includes(callingCode)) {
			push(t("blacklist.already"), "error")

			return
		}

		setBusy(true)

		try {
			const entry = await adminApi.blockCountry({
				callingCode,
				nameEn: countryName(country, "en"),
				nameAr: countryName(country, "ar")
			})

			setEntries((current) => [entry, ...current])
			push(`${flagOf(country)} ${countryName(country, locale)}`, "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setBusy(false)
		}
	}

	const unblock = async (entry: BlockedCountry) => {
		try {
			await adminApi.unblockCountry(entry.id)
			setEntries((current) => current.filter((item) => item.id !== entry.id))
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	if (!canManageUsers) {
		return (
			<AppShell title={t("blacklist.title")}>
				<section className='card'>
					<EmptyState
						icon={<ShieldAlert className='h-5 w-5' aria-hidden='true' />}
						title={t("blacklist.forbidden")}
						description={`${t("settings.role")}: ${t(`users.roles.${role}`)}`}
					/>
				</section>
			</AppShell>
		)
	}

	return (
		<AppShell
			title={t("blacklist.title")}
			subtitle={failure ? t(failure) : t("blacklist.subtitle")}
			actions={
				<button
					type='button'
					onClick={() => void load()}
					className='btn-secondary px-3 py-2'
					aria-label={t("common.refresh")}
					title={t("common.refresh")}>
					<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden='true' />
				</button>
			}>
			<div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]'>
				<section className='card overflow-hidden'>
					<header className='flex items-center gap-2 border-b border-ink-200 px-5 py-4 dark:border-ink-700'>
						<Ban className='h-4 w-4 text-rose-500' aria-hidden='true' />
						<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("blacklist.title")}</h2>
						<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>{entries.length}</span>
					</header>

					{loading && entries.length === 0 ? (
						<ul className='space-y-3 p-5'>
							{[0, 1, 2].map((index) => (
								<li key={index} className='skeleton h-10 w-full' />
							))}
						</ul>
					) : sorted.length === 0 ? (
						<EmptyState icon={<Ban className='h-5 w-5' aria-hidden='true' />} title={t("blacklist.empty")} />
					) : (
						<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
							{sorted.map((entry) => {
								const iso = codeOf(entry)

								const name = locale === "ar" ? entry.nameAr : entry.nameEn

								return (
									<li key={entry.id} className='flex animate-fade-in items-center gap-3 px-5 py-3.5'>
										<span className='text-xl' aria-hidden='true'>
											{iso ? flagOf(iso) : "\u{1F3F3}"}
										</span>
										<div className='min-w-0 flex-1'>
											<p className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
												{name}{" "}
												<span dir='ltr' className='text-ink-400'>
													+{entry.callingCode}
												</span>
											</p>
											<p className='truncate text-xs text-ink-500 dark:text-ink-400'>
												{entry.createdAt ? (
													<>
														{t("blacklist.blockedAt")} {formatDateTime(entry.createdAt)}
													</>
												) : null}
												{entry.createdBy ? ` \u00b7 ${t("blacklist.by")} ${entry.createdBy}` : ""}
											</p>
										</div>
										<button
											type='button'
											className='btn-ghost shrink-0 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950'
											onClick={() => setPendingRemove(entry)}>
											<Trash2 className='h-4 w-4' aria-hidden='true' />
											<span className='hidden sm:inline'>{t("blacklist.unblock")}</span>
										</button>
									</li>
								)
							})}
						</ul>
					)}
				</section>

				<div className='space-y-6'>
					<section className='card p-5'>
						<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("blacklist.addTitle")}</h2>
						<form
							className='mt-4 space-y-4'
							onSubmit={(event) => {
								event.preventDefault()
								void block()
							}}>
							<div>
								<label className='label' htmlFor='blacklist-country'>
									{t("blacklist.country")}
								</label>
								<CountrySelect
									id='blacklist-country'
									value={country}
									onChange={setCountry}
									disabledCodes={blockedCodes}
								/>
								{country ? (
									<p dir='ltr' className='mt-1.5 text-xs text-ink-500 dark:text-ink-400'>
										{t("blacklist.callingCode")}: +{callingCodeOf(country)}
									</p>
								) : null}
							</div>

							<button type='submit' className='btn-danger w-full justify-center' disabled={busy || !country}>
								{busy ? <Spinner /> : <Ban className='h-4 w-4' aria-hidden='true' />}
								{busy ? t("blacklist.blocking") : t("blacklist.block")}
							</button>
						</form>
					</section>

					<section className='card p-5'>
						<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("blacklist.checkTitle")}</h2>
						<p className='mt-1 text-xs text-ink-500 dark:text-ink-400'>{t("blacklist.checkSubtitle")}</p>
						<div className='mt-4'>
							<PhoneInput
								label={t("blacklist.checkPlaceholder")}
								country={testCountry}
								national={testNumber}
								onCountryChange={setTestCountry}
								onNationalChange={setTestNumber}
							/>
						</div>

						{verdict ? (
							<p
								className={cn(
									"mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm",
									verdict.status === "allowed" &&
										"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
									verdict.status === "blocked" && "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
									verdict.status === "invalid" && "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200"
								)}
								role='status'>
								{verdict.status === "allowed" ? (
									<CheckCircle2 className='h-4 w-4' aria-hidden='true' />
								) : (
									<XCircle className='h-4 w-4' aria-hidden='true' />
								)}
								{verdict.status === "allowed"
									? t("blacklist.allowed")
									: verdict.status === "blocked"
										? t("blacklist.rejected", {
												country: verdict.country ? countryName(verdict.country, locale) : t("common.unknown")
											})
										: t("blacklist.invalid")}
							</p>
						) : null}
					</section>
				</div>
			</div>

			<ConfirmDialog
				open={pendingRemove !== null}
				title={t("blacklist.unblock")}
				body={
					pendingRemove
						? `${(codeOf(pendingRemove) && flagOf(codeOf(pendingRemove) as CountryCode)) ?? ""} ${
								locale === "ar" ? pendingRemove.nameAr : pendingRemove.nameEn
							}`
						: undefined
				}
				confirmLabel={t("blacklist.unblock")}
				onConfirm={async () => {
					if (pendingRemove) await unblock(pendingRemove)
				}}
				onClose={() => setPendingRemove(null)}
			/>
		</AppShell>
	)
}
