"use client"

import { useCallback, useEffect, useState } from "react"
import { BellRing, Pencil, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"
import { adminApi } from "@/lib/api"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { NotifyPhoneFormModal } from "@/components/notify-phones/notify-phone-form-modal"
import { cn, textDirOf } from "@/lib/utils"
import type { NotifyPhone } from "@/lib/types"
import type { CreateNotifyPhonePayload, UpdateNotifyPhonePayload } from "@/lib/api"

export default function NotifyPhonesPage() {
	const { t, formatDateTime } = useI18n()

	const { role, canManageUsers } = useAuth()

	const { push } = useToast()

	const [entries, setEntries] = useState<NotifyPhone[]>([])

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [formOpen, setFormOpen] = useState(false)

	const [editing, setEditing] = useState<NotifyPhone | null>(null)

	const [pendingRemove, setPendingRemove] = useState<NotifyPhone | null>(null)

	const [busyToggleId, setBusyToggleId] = useState<number | null>(null)

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

	const openAdd = () => {
		setEditing(null)
		setFormOpen(true)
	}

	const openEdit = (entry: NotifyPhone) => {
		setEditing(entry)
		setFormOpen(true)
	}

	const submit = async (payload: CreateNotifyPhonePayload | UpdateNotifyPhonePayload) => {
		try {
			if (editing) {
				const updated = await adminApi.updateNotifyPhone(editing.id, payload)

				setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
				push(t("notifyPhones.updated"), "success")
			} else {
				const created = await adminApi.addNotifyPhone(payload as CreateNotifyPhonePayload)

				setEntries((current) => [created, ...current])
				push(t("notifyPhones.added"), "success")
			}

			setFormOpen(false)
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	const toggleEnabled = async (entry: NotifyPhone) => {
		setBusyToggleId(entry.id)

		try {
			const updated = await adminApi.updateNotifyPhone(entry.id, { notificationsEnabled: !entry.notificationsEnabled })

			setEntries((current) => current.map((item) => (item.id === updated.id ? updated : item)))
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setBusyToggleId(null)
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
				<div className='flex items-center gap-2'>
					<button
						type='button'
						onClick={() => void load()}
						className='btn-secondary px-3 py-2'
						aria-label={t("common.refresh")}
						title={t("common.refresh")}>
						<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden='true' />
					</button>
					<button type='button' onClick={openAdd} className='btn-primary px-3 py-2'>
						<Plus className='h-4 w-4' aria-hidden='true' />
						{t("notifyPhones.add")}
					</button>
				</div>
			}>
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
									📱
								</span>
								<div className='min-w-0 flex-1'>
									<p dir={textDirOf(entry.name)} className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
										{entry.name}
										<span className='ms-2 font-normal text-ink-500 dark:text-ink-400' dir='ltr'>
											+{entry.phoneNumber}
										</span>
									</p>
									<p className='truncate text-xs text-ink-500 dark:text-ink-400'>
										{t("notifyPhones.updatedAt")} {formatDateTime(entry.updatedAt)}
									</p>
								</div>

								<button
									type='button'
									onClick={() => void toggleEnabled(entry)}
									disabled={busyToggleId === entry.id}
									aria-pressed={entry.notificationsEnabled}
									aria-label={t("notifyPhones.notificationsEnabled")}
									title={t(entry.notificationsEnabled ? "notifyPhones.enabled" : "notifyPhones.disabled")}
									className='relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60'>
									<span
										className={cn(
											"absolute inset-0 rounded-full transition-colors",
											entry.notificationsEnabled ? "bg-brand-600" : "bg-ink-300 dark:bg-ink-600"
										)}
									/>
									<span
										className={cn(
											"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
											entry.notificationsEnabled
												? "translate-x-0 rtl:-translate-x-[0.05rem]"
												: "-translate-x-5 rtl:translate-x-5"
										)}
									/>
									{busyToggleId === entry.id ? (
										<Spinner className='absolute inset-0 m-auto h-3 w-3 text-white' />
									) : null}
								</button>

								<button
									type='button'
									className='btn-ghost shrink-0'
									onClick={() => openEdit(entry)}
									aria-label={t("common.edit")}
									title={t("common.edit")}>
									<Pencil className='h-4 w-4' aria-hidden='true' />
									<span className='hidden sm:inline'>{t("common.edit")}</span>
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

			<NotifyPhoneFormModal open={formOpen} entry={editing} onClose={() => setFormOpen(false)} onSubmit={submit} />

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
