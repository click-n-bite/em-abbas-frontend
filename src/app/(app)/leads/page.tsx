"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
	Bot,
	Check,
	ChevronLeft,
	ChevronRight,
	Eye,
	MessageSquare,
	Pencil,
	Plus,
	RefreshCw,
	UserRound,
	UserRoundPlus,
	X
} from "lucide-react"
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
type SortOrder = "newest" | "oldest"

const PAGE_SIZE = 8

const AVATAR_PALETTE = [
	"bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
	"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
	"bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
	"bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
	"bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
	"bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200"
]

function initialsOf(name: string): string {
	const trimmed = name.trim()

	if (!trimmed) return "?"

	const parts = trimmed.split(/\s+/)

	const first = parts[0]?.[0] ?? ""

	const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : ""

	return (first + second).toUpperCase()
}

function avatarColorOf(seed: string): string {
	let hash = 0

	for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0

	return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

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

function StatusBadge({ status }: { status: LeadStatus }) {
	const { t } = useI18n()

	return (
		<span
			className={cn(
				"badge",
				status === "open"
					? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
					: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200"
			)}>
			{t(`leads.status.${status}`)}
		</span>
	)
}

function NoteModal({
	lead,
	canEdit,
	isEditing,
	noteDraft,
	savingNote,
	onClose,
	onStartEdit,
	onCancelEdit,
	onDraftChange,
	onSave
}: {
	lead: Lead | null
	canEdit: boolean
	isEditing: boolean
	noteDraft: string
	savingNote: boolean
	onClose: () => void
	onStartEdit: () => void
	onCancelEdit: () => void
	onDraftChange: (value: string) => void
	onSave: () => void
}) {
	const { t } = useI18n()

	if (!lead) return null

	const displayName = lead.customerName?.trim() || lead.phone

	const hasNote = Boolean(lead.note && lead.note.trim().length > 0)

	const hasCloseNote = Boolean(lead.closeNote && lead.closeNote.trim().length > 0)

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
			<div className='w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-ink-800'>
				<header className='flex items-center justify-between border-b border-ink-200 px-5 py-3.5 dark:border-ink-700'>
					<div className='min-w-0'>
						<p dir={textDirOf(displayName)} className='truncate text-sm font-semibold text-ink-900 dark:text-ink-50'>
							{displayName}
						</p>
						<p className='text-xs text-ink-500 dark:text-ink-400'>{t("leads.note")}</p>
					</div>
					<button type='button' onClick={onClose} className='btn-ghost px-1.5 py-1.5' aria-label={t("common.close")}>
						<X className='h-4 w-4' aria-hidden='true' />
					</button>
				</header>

				<div className='space-y-4 px-5 py-4'>
					<section>
						<div className='mb-1.5 flex items-center justify-between'>
							<h3 className='text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500'>
								{t("leads.note")}
							</h3>
							{canEdit && !isEditing ? (
								<button
									type='button'
									onClick={onStartEdit}
									className='inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300'>
									<Pencil className='h-3 w-3' aria-hidden='true' />
									{t("leads.editNote")}
								</button>
							) : null}
						</div>

						{isEditing ? (
							<div className='flex flex-col gap-2'>
								<textarea
									autoFocus
									value={noteDraft}
									onChange={(event) => onDraftChange(event.target.value)}
									rows={4}
									placeholder={t("leads.notePlaceholder")}
									className='input w-full resize-none text-sm'
								/>
								<div className='flex justify-end gap-1.5'>
									<button type='button' onClick={onCancelEdit} className='btn-ghost px-2.5 py-1.5 text-xs'>
										<X className='h-3.5 w-3.5' aria-hidden='true' />
										{t("common.cancel")}
									</button>
									<button
										type='button'
										disabled={savingNote}
										onClick={onSave}
										className='btn-primary px-2.5 py-1.5 text-xs'>
										{savingNote ? <Spinner /> : <Check className='h-3.5 w-3.5' aria-hidden='true' />}
										{t("leads.saveNote")}
									</button>
								</div>
							</div>
						) : (
							<p
								dir={hasNote ? textDirOf(lead.note!) : undefined}
								className='whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-200'>
								{hasNote ? lead.note : <span className='text-ink-300 dark:text-ink-600'>—</span>}
							</p>
						)}
					</section>

					{lead.status === "closed" ? (
						<section>
							<h3 className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500'>
								{t("leads.closeNote")}
							</h3>
							<p
								dir={hasCloseNote ? textDirOf(lead.closeNote!) : undefined}
								className='whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-200'>
								{hasCloseNote ? lead.closeNote : <span className='text-ink-300 dark:text-ink-600'>—</span>}
							</p>
						</section>
					) : null}
				</div>
			</div>
		</div>
	)
}

export default function LeadsPage() {
	const router = useRouter()

	const { t, formatDateTime } = useI18n()

	const { canManageUsers } = useAuth()

	const { push } = useToast()

	const [leads, setLeads] = useState<Lead[]>([])

	const [total, setTotal] = useState(0)

	const [openCount, setOpenCount] = useState<number | null>(null)

	const [closedCount, setClosedCount] = useState<number | null>(null)

	const [allCount, setAllCount] = useState<number | null>(null)

	const [page, setPage] = useState(0)

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [status, setStatus] = useState<StatusFilter>("open")

	const [source, setSource] = useState<LeadSource | "all">("all")

	const [mineOnly, setMineOnly] = useState(false)

	const [search, setSearch] = useState("")

	const [sortOrder, setSortOrder] = useState<SortOrder>("newest")

	const [formOpen, setFormOpen] = useState(false)

	const [conversationOptions, setConversationOptions] = useState<{ id: string; label: string }[]>([])

	const [closingLead, setClosingLead] = useState<Lead | null>(null)

	const [busyLeadId, setBusyLeadId] = useState<number | null>(null)

	const [viewingLeadId, setViewingLeadId] = useState<number | null>(null)

	const [editingNoteId, setEditingNoteId] = useState<number | null>(null)

	const [noteDraft, setNoteDraft] = useState("")

	const [savingNote, setSavingNote] = useState(false)

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

	const loadCounts = useCallback(async () => {
		if (!isAdmin) return

		try {
			const [openRes, closedRes, allRes] = await Promise.all([
				api.leads({
					status: "open",
					source: source === "all" ? undefined : source,
					mine: mineOnly || undefined,
					search: search.trim() || undefined,
					page: 0,
					size: 1
				}),
				api.leads({
					status: "closed",
					source: source === "all" ? undefined : source,
					mine: mineOnly || undefined,
					search: search.trim() || undefined,
					page: 0,
					size: 1
				}),
				api.leads({
					source: source === "all" ? undefined : source,
					mine: mineOnly || undefined,
					search: search.trim() || undefined,
					page: 0,
					size: 1
				})
			])

			setOpenCount(openRes.total)
			setClosedCount(closedRes.total)
			setAllCount(allRes.total)
		} catch {
			// Non-critical — tabs fall back to no count badge
		}
	}, [isAdmin, source, mineOnly, search])

	useEffect(() => {
		void load()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status, source, mineOnly, page])

	useEffect(() => {
		void loadCounts()
	}, [loadCounts, status])

	useEffect(() => {
		setPage(0)

		const timer = window.setTimeout(() => void load(true), 300)

		return () => window.clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search])

	const sortedLeads = useMemo(() => {
		const copy = [...leads]

		copy.sort((a, b) => {
			const aTime = new Date(a.createdAt).getTime()

			const bTime = new Date(b.createdAt).getTime()

			return sortOrder === "newest" ? bTime - aTime : aTime - bTime
		})

		return copy
	}, [leads, sortOrder])

	const viewingLead = useMemo(
		() => sortedLeads.find((lead) => lead.id === viewingLeadId) ?? null,
		[sortedLeads, viewingLeadId]
	)

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
			void loadCounts()
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
			void loadCounts()
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setBusyLeadId(null)
			setClosingLead(null)
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
			void loadCounts()
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setBusyLeadId(null)
		}
	}

	const openNoteModal = (lead: Lead) => {
		setViewingLeadId(lead.id)
	}

	const closeNoteModal = () => {
		setViewingLeadId(null)
		setEditingNoteId(null)
		setNoteDraft("")
	}

	const startEditNote = (lead: Lead) => {
		setViewingLeadId(lead.id)
		setEditingNoteId(lead.id)
		setNoteDraft(lead.note ?? "")
	}

	const cancelEditNote = () => {
		setEditingNoteId(null)
		setNoteDraft("")
	}

	const saveNote = async (lead: Lead) => {
		setSavingNote(true)

		try {
			const updated = await adminApi.updateLead(lead.id, { note: noteDraft })

			setLeads((current) => current.map((item) => (item.id === updated.id ? updated : item)))
			push(t("leads.noteSaved"), "success")
			setEditingNoteId(null)
		} catch (error) {
			push(errorDetail(error) ?? t(errorKey(error)), "error")
		} finally {
			setSavingNote(false)
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
				{/* Toolbar — filters only, no separate result-count bar */}
				<header className='flex flex-col gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
					<div className='relative w-full sm:w-64'>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t("leads.searchPlaceholder")}
							aria-label={t("common.search")}
							className='input w-full'
						/>
					</div>

					<div className='flex flex-wrap items-center gap-2'>
						<select
							value={source}
							onChange={(event) => setSource(event.target.value as LeadSource | "all")}
							className='input w-auto'>
							<option value='all'>{t("leads.source.all")}</option>
							<option value='ai'>{t("leads.source.ai")}</option>
							<option value='agent'>{t("leads.source.agent")}</option>
						</select>

						<select
							value={sortOrder}
							onChange={(event) => setSortOrder(event.target.value as SortOrder)}
							className='input w-auto'>
							<option value='newest'>{t("leads.sortNewest")}</option>
							<option value='oldest'>{t("leads.sortOldest")}</option>
						</select>

						<label className='flex items-center gap-1.5 text-xs font-medium text-ink-600 dark:text-ink-300'>
							<input type='checkbox' checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} />
							{t("leads.mineOnly")}
						</label>

						{isAdmin ? (
							<div role='tablist' className='flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900'>
								{(["open", "closed", "all"] as StatusFilter[]).map((value) => {
									const count = value === "open" ? openCount : value === "closed" ? closedCount : allCount

									return (
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
												"flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
												status === value
													? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50"
													: "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
											)}>
											{t(`leads.filters.${value}`)}
											{count !== null && (
												<span
													className={cn(
														"rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
														status === value
															? "bg-brand-500 text-white"
															: "bg-ink-200 text-ink-600 dark:bg-ink-700 dark:text-ink-300"
													)}>
													{count}
												</span>
											)}
										</button>
									)
								})}
							</div>
						) : null}
					</div>
				</header>

				{loading && leads.length === 0 ? (
					<div className='space-y-2 p-5'>
						{[0, 1, 2].map((index) => (
							<div key={index} className='skeleton h-10 w-full' />
						))}
					</div>
				) : leads.length === 0 ? (
					<EmptyState icon={<UserRoundPlus className='h-5 w-5' aria-hidden='true' />} title={t("leads.empty")} />
				) : (
					<div className='overflow-x-auto'>
						<table className='w-full min-w-[60rem] border-collapse text-sm'>
							<thead>
								<tr className='border-b border-ink-200 bg-ink-50/60 text-start text-xs font-semibold uppercase tracking-wide text-ink-400 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-500'>
									<th className='px-5 py-2.5 text-start'>{t("leads.colName")}</th>
									<th className='px-3 py-2.5 text-start'>{t("leads.service")}</th>
									<th className='px-3 py-2.5 text-start'>{t("leads.colSource")}</th>
									<th className='px-3 py-2.5 text-start'>{t("leads.colStatus")}</th>
									<th className='px-3 py-2.5 text-start'>{t("leads.createdAt")}</th>
									<th className='px-3 py-2.5 text-start'>{t("leads.lastActivity")}</th>
									<th className='px-3 py-2.5 text-start'>{t("leads.by")}</th>
									<th className='px-5 py-2.5 text-end'>{t("leads.viewChat")}</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-ink-100 dark:divide-ink-700/70'>
								{sortedLeads.map((lead) => {
									const displayName = lead.customerName?.trim() || lead.phone

									const lastActivityAt = lead.status === "closed" && lead.closedAt ? lead.closedAt : lead.createdAt

									const attributedTo =
										lead.status === "closed"
											? (lead.closedBy?.displayName ?? t("common.unknown"))
											: (lead.createdBy?.displayName ?? t("leads.sourceLabel.ai"))

									return (
										<tr key={lead.id} className='align-top transition hover:bg-ink-50/60 dark:hover:bg-ink-800/30'>
											<td className='px-5 py-3'>
												<div className='flex items-center gap-2.5'>
													<div
														className={cn(
															"flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
															avatarColorOf(displayName)
														)}>
														{initialsOf(displayName)}
													</div>
													<div className='min-w-0'>
														<p
															dir={textDirOf(displayName)}
															className='truncate text-sm font-semibold text-ink-900 dark:text-ink-50'>
															{displayName}
														</p>
														<p dir='ltr' className='text-xs text-ink-500 dark:text-ink-400'>
															{lead.phone}
														</p>
													</div>
												</div>
											</td>

											<td className='px-3 py-3'>
												<p
													dir={textDirOf(lead.serviceName)}
													className='max-w-[10rem] text-sm text-ink-800 dark:text-ink-100'>
													{lead.serviceName}
												</p>
											</td>

											<td className='px-3 py-3'>
												<SourceBadge source={lead.source} />
											</td>

											<td className='px-3 py-3'>
												<StatusBadge status={lead.status} />
											</td>

											<td className='whitespace-nowrap px-3 py-3 text-xs text-ink-500 dark:text-ink-400'>
												{formatDateTime(lead.createdAt)}
											</td>

											<td className='whitespace-nowrap px-3 py-3 text-xs text-ink-500 dark:text-ink-400'>
												{formatDateTime(lastActivityAt)}
											</td>

											<td className='max-w-[8rem] truncate px-3 py-3 text-xs text-ink-500 dark:text-ink-400'>
												{attributedTo}
											</td>

											<td className='px-5 py-3'>
												<div className='flex items-center justify-end gap-1.5'>
													<button
														type='button'
														className='btn-secondary px-2.5 py-1.5 text-xs'
														onClick={() => openNoteModal(lead)}
														aria-label={t("leads.viewNote")}
														title={t("leads.viewNote")}>
														<Eye className='h-3.5 w-3.5' aria-hidden='true' />
													</button>

													<button
														type='button'
														className='btn-primary px-2.5 py-1.5 text-xs'
														onClick={() => router.push(`/conversations?id=${lead.conversationId}`)}
														aria-label={t("leads.viewChat")}
														title={t("leads.viewChat")}>
														<MessageSquare className='h-3.5 w-3.5' aria-hidden='true' />
													</button>

													{isAdmin && lead.status === "open" && (
														<button
															type='button'
															className='btn-secondary px-2.5 py-1.5 text-xs'
															disabled={busyLeadId === lead.id}
															onClick={() => setClosingLead(lead)}>
															{busyLeadId === lead.id ? <Spinner /> : null}
															{t("leads.close")}
														</button>
													)}

													{isAdmin && lead.status === "closed" && (
														<button
															type='button'
															className='btn-secondary px-2.5 py-1.5 text-xs'
															disabled={busyLeadId === lead.id}
															onClick={() => void reopenLead(lead)}>
															{busyLeadId === lead.id ? <Spinner /> : null}
															{t("leads.reopen")}
														</button>
													)}
												</div>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				)}

				{/* Simple pagination */}
				{totalPages > 1 ? (
					<div className='flex items-center justify-center gap-3 border-t border-ink-200 px-5 py-3 dark:border-ink-700'>
						<button
							type='button'
							className='btn-ghost px-2.5'
							disabled={page === 0}
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							aria-label={t("common.previous")}>
							<ChevronLeft className='h-4 w-4 rtl:rotate-180' aria-hidden='true' />
						</button>
						<span className='text-xs text-ink-500 dark:text-ink-400'>
							{page + 1} / {totalPages}
						</span>
						<button
							type='button'
							className='btn-ghost px-2.5'
							disabled={page + 1 >= totalPages}
							onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
							aria-label={t("common.next")}>
							<ChevronRight className='h-4 w-4 rtl:rotate-180' aria-hidden='true' />
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

			<NoteModal
				lead={viewingLead}
				canEdit={isAdmin}
				isEditing={viewingLead !== null && editingNoteId === viewingLead.id}
				noteDraft={noteDraft}
				savingNote={savingNote}
				onClose={closeNoteModal}
				onStartEdit={() => viewingLead && startEditNote(viewingLead)}
				onCancelEdit={cancelEditNote}
				onDraftChange={setNoteDraft}
				onSave={() => viewingLead && void saveNote(viewingLead)}
			/>
		</AppShell>
	)
}
