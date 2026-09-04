"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Clock3, PhoneOff, Plus, RefreshCw, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react"
import { adminApi } from "@/lib/api"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { BlockNumberFormModal } from "@/components/blocked-numbers/block-number-form-modal"
import { cn, textDirOf } from "@/lib/utils"
import type { BlockedNumbersStatusFilter, BlockedWhatsappNumber } from "@/lib/types"
import type { BlockNumberPayload } from "@/lib/api"

const STATUS_FILTERS: BlockedNumbersStatusFilter[] = ["blocked", "unblocked", "all"]

function StatusPill({ entry }: { entry: BlockedWhatsappNumber }) {
	const { t } = useI18n()

	if (entry.localStatus === "unblocked") {
		return (
			<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>
				<Undo2 className='h-3 w-3' aria-hidden='true' />
				{t("blockedNumbers.status.unblocked")}
			</span>
		)
	}

	if (entry.whatsappStatus === "blocked") {
		return (
			<span className='badge bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200'>
				<ShieldCheck className='h-3 w-3' aria-hidden='true' />
				{t("blockedNumbers.status.blocked")}
			</span>
		)
	}

	if (entry.whatsappStatus === "failed" || entry.whatsappStatus === "unblocked") {
		return (
			<span className='badge bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200'>
				<AlertTriangle className='h-3 w-3' aria-hidden='true' />
				{t("blockedNumbers.status.failed")}
			</span>
		)
	}

	return (
		<span className='badge bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200'>
			<Clock3 className='h-3 w-3' aria-hidden='true' />
			{t("blockedNumbers.status.pending")}
		</span>
	)
}

export default function BlockedNumbersPage() {
	const { t, formatDateTime } = useI18n()

	const { role, canManageUsers } = useAuth()

	const { push } = useToast()

	const [entries, setEntries] = useState<BlockedWhatsappNumber[]>([])

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [status, setStatus] = useState<BlockedNumbersStatusFilter>("blocked")

	const [search, setSearch] = useState("")

	const [formOpen, setFormOpen] = useState(false)

	const [pendingUnblock, setPendingUnblock] = useState<BlockedWhatsappNumber | null>(null)

	const [busyUnblockId, setBusyUnblockId] = useState<string | null>(null)

	const load = useCallback(
		async (silent = false) => {
			if (!silent) setLoading(true)

			try {
				const list = await adminApi.listBlockedNumbers(status, search.trim() || undefined)

				setEntries(list)
				setFailure(null)
			} catch (error) {
				setFailure(errorKey(error))
			} finally {
				setLoading(false)
			}
		},
		[status, search]
	)

	useEffect(() => {
		void load()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status])

	useEffect(() => {
		const timer = window.setTimeout(() => void load(true), 300)

		return () => window.clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search])

	const block = async (payload: BlockNumberPayload) => {
		try {
			const entry = await adminApi.blockNumber(payload)

			setEntries((current) => {
				const withoutDuplicate = current.filter((item) => item.id !== entry.id)

				return status === "unblocked" && entry.localStatus === "blocked"
					? withoutDuplicate
					: [entry, ...withoutDuplicate]
			})
			push(`${t("blockedNumbers.blocked")}: +${entry.phone}`, "success")
			setFormOpen(false)
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	const unblock = async (entry: BlockedWhatsappNumber) => {
		setBusyUnblockId(entry.id)

		try {
			const updated = await adminApi.unblockNumber(entry.id)

			setEntries((current) =>
				status === "blocked"
					? current.filter((item) => item.id !== entry.id)
					: current.map((item) => (item.id === updated.id ? updated : item))
			)
			push(t("blockedNumbers.unblocked"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setBusyUnblockId(null)
		}
	}

	const sorted = useMemo(() => [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [entries])

	if (!canManageUsers) {
		return (
			<AppShell title={t("blockedNumbers.title")}>
				<section className='card'>
					<EmptyState
						icon={<ShieldAlert className='h-5 w-5' aria-hidden='true' />}
						title={t("blockedNumbers.forbidden")}
						description={`${t("settings.role")}: ${t(`users.roles.${role}`)}`}
					/>
				</section>
			</AppShell>
		)
	}

	return (
		<AppShell
			title={t("blockedNumbers.title")}
			subtitle={failure ? t(failure) : t("blockedNumbers.subtitle")}
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
					<button type='button' className='btn-danger' onClick={() => setFormOpen(true)}>
						<Plus className='h-4 w-4' aria-hidden='true' />
						{t("blockedNumbers.block")}
					</button>
				</div>
			}>
			<section className='card overflow-hidden'>
				<header className='flex flex-col gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex items-center gap-2'>
						<PhoneOff className='h-4 w-4 text-rose-500' aria-hidden='true' />
						<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("blockedNumbers.listTitle")}</h2>
						<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>{sorted.length}</span>
					</div>

					<div className='flex flex-wrap items-center gap-2'>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t("blockedNumbers.searchPlaceholder")}
							aria-label={t("common.search")}
							dir='ltr'
							className='input w-full sm:w-48'
						/>

						<div role='tablist' className='flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900'>
							{STATUS_FILTERS.map((value) => (
								<button
									key={value}
									type='button'
									role='tab'
									aria-selected={status === value}
									onClick={() => setStatus(value)}
									className={cn(
										"rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
										status === value
											? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50"
											: "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
									)}>
									{t(`blockedNumbers.filters.${value}`)}
								</button>
							))}
						</div>
					</div>
				</header>

				{loading && sorted.length === 0 ? (
					<ul className='space-y-3 p-5'>
						{[0, 1, 2].map((index) => (
							<li key={index} className='skeleton h-12 w-full' />
						))}
					</ul>
				) : sorted.length === 0 ? (
					<EmptyState icon={<PhoneOff className='h-5 w-5' aria-hidden='true' />} title={t("blockedNumbers.empty")} />
				) : (
					<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
						{sorted.map((entry) => (
							<li key={entry.id} className='flex animate-fade-in flex-wrap items-center gap-3 px-5 py-3.5'>
								<div className='min-w-0 flex-1'>
									<p dir='ltr' className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
										+{entry.phone}
									</p>
									<p className='truncate text-xs text-ink-500 dark:text-ink-400'>
										{t("blockedNumbers.updatedAt")} {formatDateTime(entry.updatedAt)}
										{entry.reason ? <span dir={textDirOf(entry.reason)}>{` \u00b7 ${entry.reason}`}</span> : null}
									</p>
									{entry.localStatus === "blocked" && entry.whatsappStatus === "failed" && entry.whatsappError ? (
										<p className='mt-1 truncate text-xs text-amber-600 dark:text-amber-400'>{entry.whatsappError}</p>
									) : null}
								</div>

								<StatusPill entry={entry} />

								{entry.localStatus === "blocked" ? (
									<button
										type='button'
										className='btn-ghost shrink-0 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950'
										disabled={busyUnblockId === entry.id}
										onClick={() => setPendingUnblock(entry)}>
										{busyUnblockId === entry.id ? <Spinner /> : <Undo2 className='h-4 w-4' aria-hidden='true' />}
										<span className='hidden sm:inline'>{t("blockedNumbers.unblock")}</span>
									</button>
								) : null}
							</li>
						))}
					</ul>
				)}
			</section>

			<BlockNumberFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={block} />

			<ConfirmDialog
				open={pendingUnblock !== null}
				title={t("blockedNumbers.unblock")}
				body={pendingUnblock ? `+${pendingUnblock.phone}` : undefined}
				confirmLabel={t("blockedNumbers.unblock")}
				tone='primary'
				onConfirm={async () => {
					if (pendingUnblock) await unblock(pendingUnblock)
				}}
				onClose={() => setPendingUnblock(null)}
			/>
		</AppShell>
	)
}
