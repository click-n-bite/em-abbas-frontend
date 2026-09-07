"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bot, ChevronLeft, ChevronRight, Headphones, Plus, RefreshCw, UserPlus, Users } from "lucide-react"
import { adminApi, api } from "@/lib/api"
import { errorDetail, errorKey } from "@/lib/errors"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { LeadFormModal } from "@/components/leads/lead-form-modal"
import { LeadStatusModal } from "@/components/leads/lead-status-modal"
import type { CreateLeadPayload, LeadsListParams, UpdateLeadPayload } from "@/lib/api"
import { Lead, LeadSource, LeadStatus } from "@/lib/features/leads/types"

type StatusFilter = LeadStatus | "all"

const STATUS_FILTERS: StatusFilter[] = ["open", "closed", "all"]

const SOURCE_FILTERS: Array<LeadSource | "all"> = ["all", "ai", "agent"]

const PAGE_SIZE = 5

function SourceBadge({ lead }: { lead: Lead }) {
	const { t } = useI18n()

	if (lead.source === "ai") {
		return (
			<span className='badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'>
				<Bot className='h-3 w-3' aria-hidden='true' />
				{t("leads.sourceLabel.ai")}
			</span>
		)
	}

	return (
		<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>
			<Headphones className='h-3 w-3' aria-hidden='true' />
			{lead.createdBy?.displayName ?? t("leads.sourceLabel.agent")}
		</span>
	)
}

function StatusBadge({ status }: { status: LeadStatus }) {
	const { t } = useI18n()

	return status === "open" ? (
		<span className='badge bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'>
			{t("leads.status.open")}
		</span>
	) : (
		<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>{t("leads.status.closed")}</span>
	)
}

export default function LeadsPage() {
	const { t, formatDateTime } = useI18n()

	const { canManageUsers } = useAuth()

	const { push } = useToast()

	const [leads, setLeads] = useState<Lead[]>([])

	const [total, setTotal] = useState(0)

	const [totalPages, setTotalPages] = useState(1)

	const [page, setPage] = useState(0)

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [status, setStatus] = useState<StatusFilter>("open")

	const [source, setSource] = useState<LeadSource | "all">("all")

	const [mine, setMine] = useState(false)

	const [search, setSearch] = useState("")

	const [formOpen, setFormOpen] = useState(false)

	const [editingLead, setEditingLead] = useState<Lead | null>(null)

	const load = useCallback(
		async (silent = false) => {
			if (!silent) setLoading(true)

			try {
				const params: LeadsListParams = {
					page,
					size: PAGE_SIZE,
					mine: mine || undefined,
					search: search.trim() || undefined
				}

				if (canManageUsers && status !== "all") params.status = status

				if (source !== "all") params.source = source

				const result = await api.leads(params)

				setLeads(result.items)
				setTotal(result.total)
				setTotalPages(Math.max(result.totalPages, 1))
				setFailure(null)
			} catch (error) {
				setFailure(errorKey(error))
			} finally {
				setLoading(false)
			}
		},
		[page, status, source, mine, search, canManageUsers]
	)

	useEffect(() => {
		void load()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [page, status, source, mine])

	useEffect(() => {
		const timer = window.setTimeout(() => void load(true), 300)

		return () => window.clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search])

	const createLead = async (payload: CreateLeadPayload) => {
		try {
			const lead = await api.createLead(payload)

			push(t("leads.added"), "success")
			setFormOpen(false)

			const belongsToCurrentView =
				(!canManageUsers || status === "all" || status === lead.status) && (source === "all" || source === lead.source)

			if (belongsToCurrentView && page === 0) {
				setLeads((current) => [lead, ...current].slice(0, PAGE_SIZE))
				setTotal((current) => current + 1)
			} else {
				void load(true)
			}
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	const updateLead = async (id: number, payload: UpdateLeadPayload) => {
		try {
			const updated = await adminApi.updateLead(id, payload)

			push(t("leads.updated"), "success")
			setEditingLead(null)

			const stillBelongs = !canManageUsers || status === "all" || status === updated.status

			setLeads((current) => {
				if (!stillBelongs) return current.filter((item) => item.id !== updated.id)

				return current.map((item) => (item.id === updated.id ? updated : item))
			})

			if (!stillBelongs) setTotal((current) => Math.max(current - 1, 0))
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		}
	}

	const rangeLabel = useMemo(() => t("leads.page", { page: page + 1, total: totalPages }), [t, page, totalPages])

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
					<button type='button' className='btn-primary' onClick={() => setFormOpen(true)}>
						<Plus className='h-4 w-4' aria-hidden='true' />
						{t("leads.add")}
					</button>
				</div>
			}>
			<section className='card overflow-hidden'>
				<header className='flex flex-col gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex items-center gap-2'>
						<UserPlus className='h-4 w-4 text-brand-500' aria-hidden='true' />
						<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("leads.listTitle")}</h2>
						<span className='badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'>{total}</span>
					</div>

					<div className='flex flex-wrap items-center gap-2'>
						<input
							value={search}
							onChange={(event) => {
								setSearch(event.target.value)
								setPage(0)
							}}
							placeholder={t("leads.searchPlaceholder")}
							aria-label={t("common.search")}
							className='input w-full sm:w-52'
						/>

						<button
							type='button'
							onClick={() => {
								setMine((current) => !current)
								setPage(0)
							}}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition",
								mine
									? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
									: "border-ink-200 text-ink-500 hover:text-ink-800 dark:border-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
							)}>
							<Users className='h-3.5 w-3.5' aria-hidden='true' />
							{t("leads.mineOnly")}
						</button>

						<div role='tablist' className='flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900'>
							{SOURCE_FILTERS.map((value) => (
								<button
									key={value}
									type='button'
									role='tab'
									aria-selected={source === value}
									onClick={() => {
										setSource(value)
										setPage(0)
									}}
									className={cn(
										"rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
										source === value
											? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50"
											: "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
									)}>
									{t(`leads.source.${value}`)}
								</button>
							))}
						</div>

						{canManageUsers ? (
							<div role='tablist' className='flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900'>
								{STATUS_FILTERS.map((value) => (
									<button
										key={value}
										type='button'
										role='tab'
										aria-selected={status === value}
										onClick={() => {
											setStatus(value)
											setPage(0)
										}}
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
							<li key={index} className='skeleton h-14 w-full' />
						))}
					</ul>
				) : leads.length === 0 ? (
					<EmptyState icon={<UserPlus className='h-5 w-5' aria-hidden='true' />} title={t("leads.empty")} />
				) : (
					<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
						{leads.map((lead) => (
							<li key={lead.id} className='flex animate-fade-in flex-wrap items-center gap-3 px-5 py-3.5'>
								<Avatar name={lead.customerName} seed={lead.phone} size='sm' />

								<div className='min-w-0 flex-1'>
									<Link
										href={`/conversations?id=${lead.conversationId}`}
										className='truncate text-sm font-medium text-ink-900 hover:text-brand-600 dark:text-ink-50 dark:hover:text-brand-300'>
										{lead.customerName || `+${lead.phone}`}
									</Link>
									<p className='truncate text-xs text-ink-500 dark:text-ink-400'>{lead.serviceName}</p>
									<p className='mt-1 truncate text-xs text-ink-500 dark:text-ink-400'>
										{formatDateTime(lead.createdAt)}
									</p>
									{lead.status === "closed" && lead.closeNote ? (
										<p className='mt-1 truncate text-xs text-ink-500 dark:text-ink-400'>{lead.closeNote}</p>
									) : null}
								</div>

								<SourceBadge lead={lead} />
								<StatusBadge status={lead.status} />

								{canManageUsers ? (
									<button type='button' className='btn-ghost shrink-0' onClick={() => setEditingLead(lead)}>
										{lead.status === "open" ? t("leads.closeLead") : t("leads.openLead")}
									</button>
								) : null}
							</li>
						))}
					</ul>
				)}

				{totalPages > 1 ? (
					<footer className='flex items-center justify-between border-t border-ink-200 px-5 py-3 dark:border-ink-700'>
						<button
							type='button'
							className='btn-secondary px-3 py-1.5 text-xs'
							disabled={page === 0}
							onClick={() => setPage((current) => Math.max(current - 1, 0))}>
							<ChevronLeft className='h-3.5 w-3.5 rtl:rotate-180' aria-hidden='true' />
							{t("leads.previous")}
						</button>
						<span className='text-xs text-ink-500 dark:text-ink-400'>{rangeLabel}</span>
						<button
							type='button'
							className='btn-secondary px-3 py-1.5 text-xs'
							disabled={page + 1 >= totalPages}
							onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}>
							{t("leads.next")}
							<ChevronRight className='h-3.5 w-3.5 rtl:rotate-180' aria-hidden='true' />
						</button>
					</footer>
				) : null}
			</section>

			<LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={createLead} />

			{canManageUsers ? (
				<LeadStatusModal lead={editingLead} onClose={() => setEditingLead(null)} onSubmit={updateLead} />
			) : null}
		</AppShell>
	)
}
