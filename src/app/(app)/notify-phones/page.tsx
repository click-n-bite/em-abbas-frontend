"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BellRing, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"
import { adminApi } from "@/lib/api"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PhoneInput } from "@/components/phone-input"
import { countryName, flagOf, parsePhone, type CountryCode } from "@/lib/countries"
import { cn } from "@/lib/utils"
import type { NotifyPhone } from "@/lib/types"

export default function NotifyPhonesPage() {
	const { t, locale, formatDateTime } = useI18n()

	const { agent, role, canManageUsers } = useAuth()

	const { push } = useToast()

	const [entries, setEntries] = useState<NotifyPhone[]>([])

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [country, setCountry] = useState<CountryCode | null>("SA")

	const [national, setNational] = useState("")

	const [label, setLabel] = useState("")

	const [busy, setBusy] = useState(false)

	const [pendingRemove, setPendingRemove] = useState<NotifyPhone | null>(null)

	const load = useCallback(async () => {
		try {
			const list = await adminApi.listNotifyPhones()

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

	const parsed = useMemo(() => (country ? parsePhone(national, country) : null), [country, national])

	const ready = Boolean(parsed?.valid && parsed.e164)

	const add = async () => {
		if (!ready || !parsed?.e164 || busy) return

		if (entries.some((entry) => entry.phone === parsed.e164)) {
			push(t("notifyPhones.duplicate"), "error")

			return
		}

		setBusy(true)

		try {
			const entry = await adminApi.addNotifyPhone({
				phone: parsed.e164,
				country: parsed.country ?? country ?? null,
				label: label.trim() || null,
				createdBy: agent?.email ?? null
			})

			setEntries((current) => [entry, ...current])
			setNational("")
			setLabel("")
			push(t("notifyPhones.added"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setBusy(false)
		}
	}

	const remove = async (entry: NotifyPhone) => {
		try {
			await adminApi.deleteNotifyPhone(entry.id)
			setEntries((current) => current.filter((item) => item.id !== entry.id))
			push(t("notifyPhones.deleted"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	if (!canManageUsers) {
		return (
			<AppShell title={t("notifyPhones.title")}>
				<section className='card'>
					<EmptyState
						icon={<ShieldAlert className='h-5 w-5' aria-hidden='true' />}
						title={t("notifyPhones.forbidden")}
						description={`${t("settings.role")}: ${t(`users.roles.${role}`)}`}
					/>
				</section>
			</AppShell>
		)
	}

	return (
		<AppShell
			title={t("notifyPhones.title")}
			subtitle={failure ? t(failure) : t("notifyPhones.subtitle")}
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
						<BellRing className='h-4 w-4 text-brand-600' aria-hidden='true' />
						<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("notifyPhones.listTitle")}</h2>
						<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>{entries.length}</span>
					</header>

					{loading && entries.length === 0 ? (
						<ul className='space-y-3 p-5'>
							{[0, 1, 2].map((index) => (
								<li key={index} className='skeleton h-10 w-full' />
							))}
						</ul>
					) : entries.length === 0 ? (
						<EmptyState
							icon={<BellRing className='h-5 w-5' aria-hidden='true' />}
							title={t("notifyPhones.empty")}
							description={t("notifyPhones.emptyHint")}
						/>
					) : (
						<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
							{entries.map((entry) => (
								<li key={entry.id} className='flex animate-fade-in items-center gap-3 px-5 py-3.5'>
									<span className='text-xl' aria-hidden='true'>
										{entry.country ? flagOf(entry.country) : "📱"}
									</span>
									<div className='min-w-0 flex-1'>
										<p className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
											<span dir='ltr'>{entry.phone}</span>
											{entry.label ? (
												<span className='ms-2 font-normal text-ink-500 dark:text-ink-400'>{entry.label}</span>
											) : null}
										</p>
										<p className='truncate text-xs text-ink-500 dark:text-ink-400'>
											{entry.country ? `${countryName(entry.country, locale)} · ` : ""}
											{t("notifyPhones.addedAt")} {formatDateTime(entry.createdAt)}
											{entry.createdBy ? ` · ${t("notifyPhones.by")} ${entry.createdBy}` : ""}
										</p>
									</div>
									<button
										type='button'
										className='btn-ghost shrink-0 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950'
										onClick={() => setPendingRemove(entry)}>
										<Trash2 className='h-4 w-4' aria-hidden='true' />
										<span className='hidden sm:inline'>{t("common.delete")}</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</section>

				<section className='card p-5'>
					<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("notifyPhones.addTitle")}</h2>
					<p className='mt-1 text-xs text-ink-500 dark:text-ink-400'>{t("notifyPhones.addSubtitle")}</p>
					<form
						className='mt-4 space-y-4'
						onSubmit={(event) => {
							event.preventDefault()
							void add()
						}}>
						<PhoneInput
							label={t("notifyPhones.phone")}
							required
							country={country}
							national={national}
							onCountryChange={setCountry}
							onNationalChange={setNational}
						/>

						<div>
							<label className='label' htmlFor='notify-label'>
								{t("notifyPhones.label")}{" "}
								<span className='font-normal lowercase tracking-normal'>({t("common.optional")})</span>
							</label>
							<input
								id='notify-label'
								className='input'
								value={label}
								onChange={(event) => setLabel(event.target.value)}
								placeholder={t("notifyPhones.labelPlaceholder")}
							/>
						</div>

						<button type='submit' className='btn-primary w-full justify-center' disabled={busy || !ready}>
							{busy ? <Spinner /> : <Plus className='h-4 w-4' aria-hidden='true' />}
							{busy ? t("notifyPhones.adding") : t("notifyPhones.add")}
						</button>
					</form>
				</section>
			</div>

			<ConfirmDialog
				open={pendingRemove !== null}
				title={t("notifyPhones.deleteTitle")}
				body={pendingRemove ? t("notifyPhones.deleteBody", { phone: pendingRemove.phone }) : undefined}
				confirmLabel={t("common.delete")}
				onConfirm={async () => {
					if (pendingRemove) await remove(pendingRemove)
				}}
				onClose={() => setPendingRemove(null)}
			/>
		</AppShell>
	)
}
