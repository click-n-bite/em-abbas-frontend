"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, ChevronLeft, ChevronRight, MessageSquare, Plus, RefreshCw, UserRound, UserRoundPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { adminApi, api, ApiError } from "@/lib/api"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { LeadFormModal } from "@/components/leads/lead-form-modal"
import { CloseLeadModal } from "@/components/leads/close-lead-modal"
import { cn, textDirOf } from "@/lib/utils"
import type { Lead, LeadSource, LeadStatus } from "@/lib/types"

type StatusFilter = LeadStatus | "all"

const PAGE_SIZE = 4

function SourceBadge({ source }: { source: LeadSource }) {
	const { t } = useI18n()

	if (source === "ai") {
		return (
			<span className='badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'>
				<Bot className='h-3 w-3' aria-hidden='true' />
				{t("leads.sourceLabel.ai")}
			</span>
		)
	}

	return (
		<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>
			<UserRound className='h-3 w-3' aria-hidden='true' />
			{t("leads.sourceLabel.agent")}
		</span>
	)
}

export default function LeadsPage() {
	const router = useRouter()

	const { t, formatDateTime } = useI18n()

	const { canManageUsers } = useAuth()

	const { push } = useToast()

	const [leads, setLeads] = useState<Lead[]>([])

	const [total, setTotal] = useState(0)

	const [page, setPage] = useState(0)

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [status, setStatus] = useState<StatusFilter>("open")

	const [source, setSource] = useState<LeadSource | "all">("all")

	const [mineOnly, setMineOnly] = useState(false)

	const [search, setSearch] = useState("")

	const [formOpen, setFormOpen] = useState(false)

	const [conversationOptions, setConversationOptions] = useState<{ id: string; label: string }[]>([])

	const [closingLead, setClosingLead] = useState<Lead | null>(null)

	const [busyLeadId, setBusyLeadId] = useState<number | null>(null)

	const isAdmin = canManageUsers

	const load = useCallback(
		async (silent = false) => {
			if (!silent) setLoading(true)

			try {
				const result = await api.leads({
					status: isAdmin && status !== "all" ? status : undefined,
					source: source === "all" ? undefined : source,
					mine: mineOnly || undefined,
					search: search.trim() || undefined,
					page,
					size: PAGE_SIZE
				})

				setLeads(result.items)
				setTotal(result.total)
				setFailure(null)
			} catch (error) {
				setFailure(errorKey(error))
			} finally {
				setLoading(false)
			}
		},
		[isAdmin, status, source, mineOnly, search, page]
	)

	useEffect(() => {
		void load()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status, source, mineOnly, page])

	useEffect(() => {
		setPage(0)

		const timer = window.setTimeout(() => void load(true), 300)

		return () => window.clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search])

	const openAddModal = () => {
		api
			.conversations("all")
			.then((list) =>
				setConversationOptions(
					list
						.filter((conversation) => !conversation.hidden)
						.map((conversation) => ({
							id: conversation.id,
							label: conversation.customerName?.trim() || conversation.phone
						}))
				)
			)
			.catch(() => setConversationOptions([]))

		setFormOpen(true)
	}

	const submitLead = async (payload: { conversationId: string; serviceId: number; note?: string }) => {
		try {
			const lead = await api.createLead(payload)

			push(t("leads.added"), "success")
			setFormOpen(false)
			setLeads((current) => [lead, ...current])
			setTotal((current) => current + 1)
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				push(t("leads.duplicate"), "error")
			} else {
				push(errorDetail(error) ?? t(errorKey(error)), "error")
			}

			throw error
		}
	}

	const closeLead = async (closeNote: string) => {
		if (!closingLead) return

		setBusyLeadId(closingLead.id)

		try {
			const updated = await adminApi.updateLead(closingLead.id, { status: "closed", closeNote })

			setLeads((current) =>
				status !== "all" && status !== "closed"
					? current.filter((item) => item.id !== updated.id)
					: current.map((item) => (item.id === updated.id ? updated : item))
			)
			push(t("leads.closed"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setBusyLeadId(null)
		}
	}

	const reopenLead = async (lead: Lead) => {
		setBusyLeadId(lead.id)

		try {
			const updated = await adminApi.updateLead(lead.id, { status: "open" })

			setLeads((current) =>
				status !== "all" && status !== "open"
					? current.filter((item) => item.id !== updated.id)
					: current.map((item) => (item.id === updated.id ? updated : item))
			)
			push(t("leads.reopened"), "success")
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setBusyLeadId(null)
		}
	}

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

	return (
		<AppShell
			title={t("leads.title")}
			subtitle={failure ? t(failure) : t("leads.subtitle")}
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
					<button type='button' className='btn-primary' onClick={openAddModal}>
						<Plus className='h-4 w-4' aria-hidden='true' />
						{t("leads.add")}
					</button>
				</div>
			}>
			<section className='card overflow-hidden'>
				<header className='flex flex-col gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex items-center gap-2'>
						<UserRoundPlus className='h-4 w-4 text-brand-500' aria-hidden='true' />
						<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("leads.listTitle")}</h2>
						<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>{total}</span>
					</div>

					<div className='flex flex-wrap items-center gap-2'>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t("leads.searchPlaceholder")}
							aria-label={t("common.search")}
							className='input w-full sm:w-56'
						/>

						<select
							value={source}
							onChange={(event) => setSource(event.target.value as LeadSource | "all")}
							className='input w-auto'>
							<option value='all'>{t("leads.source.all")}</option>
							<option value='ai'>{t("leads.source.ai")}</option>
							<option value='agent'>{t("leads.source.agent")}</option>
						</select>

						<label className='flex items-center gap-1.5 text-xs font-medium text-ink-600 dark:text-ink-300'>
							<input type='checkbox' checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} />
							{t("leads.mineOnly")}
						</label>

						{isAdmin ? (
							<div role='tablist' className='flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900'>
								{(["open", "closed", "all"] as StatusFilter[]).map((value) => (
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
										{t(`leads.filters.${value}`)}
									</button>
								))}
							</div>
						) : null}
					</div>
				</header>

				{loading && leads.length === 0 ? (
					<ul className='space-y-3 p-5'>
						{[0, 1, 2].map((index) => (
							<li key={index} className='skeleton h-16 w-full' />
						))}
					</ul>
				) : leads.length === 0 ? (
					<EmptyState icon={<UserRoundPlus className='h-5 w-5' aria-hidden='true' />} title={t("leads.empty")} />
				) : (
					<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
						{leads.map((lead) => (
							<li key={lead.id} className='flex flex-wrap items-start gap-3 px-5 py-4'>
								<div className='min-w-0 flex-1'>
									<div className='flex flex-wrap items-center gap-2'>
										<p
											dir={textDirOf(lead.customerName)}
											className='truncate text-sm font-semibold text-ink-900 dark:text-ink-50'>
											{lead.customerName?.trim() || lead.phone}
										</p>
										<SourceBadge source={lead.source} />
										<span
											className={cn(
												"badge",
												lead.status === "open"
													? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
													: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200"
											)}>
											{t(`leads.status.${lead.status}`)}
										</span>
									</div>

									<p dir='ltr' className='mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400'>
										{lead.phone}
									</p>

									<p className='mt-1 text-xs text-ink-500 dark:text-ink-400'>
										{lead.serviceName}
										{lead.note ? <span dir={textDirOf(lead.note)}>{` · ${lead.note}`}</span> : null}
									</p>

									<p className='mt-1 text-xs text-ink-400'>
										{t("leads.createdBy")}: {lead.createdBy?.displayName ?? t("leads.sourceLabel.ai")} ·{" "}
										{formatDateTime(lead.createdAt)}
									</p>

									{lead.status === "closed" ? (
										<p className='mt-1 text-xs text-ink-400'>
											{t("leads.closedBy")}: {lead.closedBy?.displayName ?? t("common.unknown")}
											{lead.closedAt ? ` · ${formatDateTime(lead.closedAt)}` : ""}
											{lead.closeNote ? <span dir={textDirOf(lead.closeNote)}>{` · ${lead.closeNote}`}</span> : null}
										</p>
									) : null}
								</div>

								<div className='flex shrink-0 items-center gap-2'>
									<button
										type='button'
										className='btn-ghost'
										onClick={() => router.push(`/conversations?id=${lead.conversationId}`)}
										aria-label={t("leads.viewChat")}
										title={t("leads.viewChat")}>
										<MessageSquare className='h-4 w-4' aria-hidden='true' />
										<span className='hidden sm:inline'>{t("leads.viewChat")}</span>
									</button>

									{isAdmin && lead.status === "open" ? (
										<button
											type='button'
											className='btn-secondary'
											disabled={busyLeadId === lead.id}
											onClick={() => setClosingLead(lead)}>
											{busyLeadId === lead.id ? <Spinner /> : null}
											{t("leads.close")}
										</button>
									) : null}

									{isAdmin && lead.status === "closed" ? (
										<button
											type='button'
											className='btn-secondary'
											disabled={busyLeadId === lead.id}
											onClick={() => void reopenLead(lead)}>
											{busyLeadId === lead.id ? <Spinner /> : null}
											{t("leads.reopen")}
										</button>
									) : null}
								</div>
							</li>
						))}
					</ul>
				)}

				{totalPages > 1 ? (
					<div className='flex items-center justify-center gap-3 border-t border-ink-200 px-5 py-3 dark:border-ink-700'>
						<button
							type='button'
							className='btn-ghost px-2.5'
							disabled={page === 0}
							onClick={() => setPage((current) => Math.max(0, current - 1))}
							aria-label={t("common.retry")}>
							<ChevronLeft className='h-4 w-4' aria-hidden='true' />
						</button>
						<span className='text-xs text-ink-500 dark:text-ink-400'>
							{page + 1} / {totalPages}
						</span>
						<button
							type='button'
							className='btn-ghost px-2.5'
							disabled={page + 1 >= totalPages}
							onClick={() => setPage((current) => current + 1)}>
							<ChevronRight className='h-4 w-4' aria-hidden='true' />
						</button>
					</div>
				) : null}
			</section>

			<LeadFormModal
				open={formOpen}
				onClose={() => setFormOpen(false)}
				onSubmit={submitLead}
				conversationOptions={conversationOptions}
			/>

			<CloseLeadModal lead={closingLead} onClose={() => setClosingLead(null)} onSubmit={closeLead} />
		</AppShell>
	)
}
