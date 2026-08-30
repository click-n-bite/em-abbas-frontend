"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BellRing, Pencil, Phone, Plus, RefreshCw, ShieldAlert, Trash2, X } from "lucide-react"
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
import { parsePhone, type CountryCode } from "@/lib/countries"
import { cn } from "@/lib/utils"
import type { NotifyPhone } from "@/lib/types"

/** Digits only, matching how the backend stores `phoneNumber` (no leading "+"). */
function digitsOnly(value: string): string {
	return value.replace(/\D/g, "")
}

export default function NotifyPhonesPage() {
	const { t, formatDateTime } = useI18n()

	const { role, canManageUsers } = useAuth()

	const { push } = useToast()

	const [entries, setEntries] = useState<NotifyPhone[]>([])

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [country, setCountry] = useState<CountryCode | null>("SA")

	const [national, setNational] = useState("")

	const [name, setName] = useState("")

	const [busy, setBusy] = useState(false)

	const [pendingRemove, setPendingRemove] = useState<NotifyPhone | null>(null)

	const [editing, setEditing] = useState<NotifyPhone | null>(null)

	const [editName, setEditName] = useState("")

	const [editBusy, setEditBusy] = useState(false)

	const [toggling, setToggling] = useState<number | null>(null)

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

	const ready = Boolean(parsed?.valid && parsed.e164 && name.trim())

	const add = async () => {
		if (!ready || !parsed?.e164 || busy) return

		const phoneDigits = digitsOnly(parsed.e164)

		if (entries.some((entry) => entry.phoneNumber === phoneDigits)) {
			push(t("notifyPhones.duplicate"), "error")

			return
		}

		setBusy(true)

		try {
			const entry = await adminApi.addNotifyPhone({
				name: name.trim(),
				phoneNumber: parsed.e164,
				notificationsEnabled: true
			})

			setEntries((current) => [entry, ...current])
			setNational("")
			setName("")
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

	const toggleEnabled = async (entry: NotifyPhone) => {
		setToggling(entry.id)

		const next = !entry.notificationsEnabled

		setEntries((current) =>
			current.map((item) => (item.id === entry.id ? { ...item, notificationsEnabled: next } : item))
		)

		try {
			const updated = await adminApi.updateNotifyPhone(entry.id, { notificationsEnabled: next })

			setEntries((current) => current.map((item) => (item.id === entry.id ? updated : item)))
		} catch (error) {
			setEntries((current) => current.map((item) => (item.id === entry.id ? entry : item)))
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setToggling(null)
		}
	}

	const startEdit = (entry: NotifyPhone) => {
		setEditing(entry)
		setEditName(entry.name)
	}

	const saveEdit = async () => {
		if (!editing || !editName.trim() || editBusy) return

		setEditBusy(true)

		try {
			const updated = await adminApi.updateNotifyPhone(editing.id, { name: editName.trim() })

			setEntries((current) => current.map((item) => (item.id === editing.id ? updated : item)))
			setEditing(null)
			push(t("notifyPhones.updated"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setEditBusy(false)
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
									<span
										className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300'
										aria-hidden='true'>
										<Phone className='h-4 w-4' />
									</span>
									<div className='min-w-0 flex-1'>
										<p className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
											{entry.name}
											{!entry.notificationsEnabled ? (
												<span className='ms-2 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-normal text-ink-500 dark:bg-ink-700 dark:text-ink-300'>
													{t("common.disabled")}
												</span>
											) : null}
										</p>
										<p className='truncate text-xs text-ink-500 dark:text-ink-400'>
											<span dir='ltr'>+{entry.phoneNumber}</span>
											{" · "}
											{t("notifyPhones.addedAt")} {formatDateTime(entry.createdAt)}
										</p>
									</div>

									<label className='inline-flex shrink-0 cursor-pointer items-center gap-2'>
										<span className='sr-only'>{t("notifyPhones.notificationsEnabled")}</span>
										<span
											onClick={() => !toggling && void toggleEnabled(entry)}
											className={cn(
												"relative h-5 w-9 shrink-0 rounded-full transition",
												entry.notificationsEnabled ? "bg-brand-600" : "bg-ink-300 dark:bg-ink-600",
												toggling === entry.id && "opacity-60"
											)}
											role='switch'
											aria-checked={entry.notificationsEnabled}>
											<span
												className={cn(
													"absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
													entry.notificationsEnabled ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0.5"
												)}
											/>
										</span>
									</label>

									<button
										type='button'
										className='btn-ghost shrink-0'
										onClick={() => startEdit(entry)}
										aria-label={t("common.edit")}
										title={t("common.edit")}>
										<Pencil className='h-4 w-4' aria-hidden='true' />
									</button>

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
						<div>
							<label className='label' htmlFor='notify-name'>
								{t("notifyPhones.name")}
							</label>
							<input
								id='notify-name'
								className='input'
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder={t("notifyPhones.namePlaceholder")}
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

						<button type='submit' className='btn-primary w-full justify-center' disabled={busy || !ready}>
							{busy ? <Spinner /> : <Plus className='h-4 w-4' aria-hidden='true' />}
							{busy ? t("notifyPhones.adding") : t("notifyPhones.add")}
						</button>
					</form>
				</section>
			</div>

			{editing ? (
				<div
					className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
					role='dialog'
					aria-modal='true'>
					<div className='w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-ink-800'>
						<div className='mb-4 flex items-center justify-between'>
							<h3 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("notifyPhones.editTitle")}</h3>
							<button type='button' className='btn-ghost h-8 w-8 justify-center p-0' onClick={() => setEditing(null)}>
								<X className='h-4 w-4' aria-hidden='true' />
							</button>
						</div>
						<label className='label' htmlFor='notify-edit-name'>
							{t("notifyPhones.name")}
						</label>
						<input
							id='notify-edit-name'
							className='input'
							value={editName}
							onChange={(event) => setEditName(event.target.value)}
							autoFocus
						/>
						<p className='mt-2 text-xs text-ink-500 dark:text-ink-400' dir='ltr'>
							+{editing.phoneNumber}
						</p>
						<div className='mt-5 flex justify-end gap-2'>
							<button type='button' className='btn-secondary' onClick={() => setEditing(null)}>
								{t("common.cancel")}
							</button>
							<button
								type='button'
								className='btn-primary'
								onClick={() => void saveEdit()}
								disabled={editBusy || !editName.trim()}>
								{editBusy ? <Spinner /> : null}
								{t("common.save")}
							</button>
						</div>
					</div>
				</div>
			) : null}

			<ConfirmDialog
				open={pendingRemove !== null}
				title={t("notifyPhones.deleteTitle")}
				body={pendingRemove ? t("notifyPhones.deleteBody", { phone: `+${pendingRemove.phoneNumber}` }) : undefined}
				confirmLabel={t("common.delete")}
				onConfirm={async () => {
					if (pendingRemove) await remove(pendingRemove)
				}}
				onClose={() => setPendingRemove(null)}
			/>
		</AppShell>
	)
}
