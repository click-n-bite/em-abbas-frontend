"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	Bot,
	Calendar,
	Check,
	ChevronLeft,
	ChevronRight,
	FileText,
	MessageSquare,
	MoreVertical,
	Plus,
	RefreshCw,
	RotateCcw,
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

const PAGE_SIZE = 4

const NOTE_PREVIEW_LEN = 200

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

	const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null)

	const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

	const [editingNoteId, setEditingNoteId] = useState<number | null>(null)

	const [noteDraft, setNoteDraft] = useState("")

	const [savingNote, setSavingNote] = useState(false)

	const menuRef = useRef<HTMLDivElement | null>(null)

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

	// Tab counts (open / closed / all) — independent of the active status tab
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

	// Close the kebab menu on outside click
	useEffect(() => {
		if (menuOpenId === null) return

		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpenId(null)
			}
		}

		document.addEventListener("mousedown", handleClick)

		return () => document.removeEventListener("mousedown", handleClick)
	}, [menuOpenId])

	const sortedLeads = useMemo(() => {
		const copy = [...leads]

		copy.sort((a, b) => {
			const aTime = new Date(a.createdAt).getTime()

			const bTime = new Date(b.createdAt).getTime()

			return sortOrder === "newest" ? bTime - aTime : aTime - bTime
		})

		return copy
	}, [leads, sortOrder])

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

	const toggleNote = (leadId: number) => {
		setExpandedNoteId((current) => (current === leadId ? null : leadId))
	}

	const startEditNote = (lead: Lead) => {
		setMenuOpenId(null)
		setEditingNoteId(lead.id)
		setNoteDraft(lead.note ?? "")
		setExpandedNoteId(lead.id)
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

	const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1

	const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total)

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
				{/* Toolbar */}
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

						<label className='flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400'>
							{t("leads.sortBy")}
							<select
								value={sortOrder}
								onChange={(event) => setSortOrder(event.target.value as SortOrder)}
								className='input w-auto'>
								<option value='newest'>{t("leads.sortNewest")}</option>
								<option value='oldest'>{t("leads.sortOldest")}</option>
							</select>
						</label>

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

				{/* Result count */}
				<div className='flex items-center justify-between border-b border-ink-200 bg-ink-50/50 px-5 py-2.5 text-xs text-ink-500 dark:border-ink-700 dark:bg-ink-800/30 dark:text-ink-400'>
					<span>
						<span className='font-semibold text-ink-900 dark:text-ink-50'>{total}</span>{" "}
						{t("leads.listTitle").toLowerCase()}
					</span>
					<span>{t("activity.showingRange", { start: rangeStart, end: rangeEnd, total })}</span>
				</div>

				{loading && leads.length === 0 ? (
					<ul className='space-y-3 p-5'>
						{[0, 1, 2].map((index) => (
							<li key={index} className='skeleton h-20 w-full' />
						))}
					</ul>
				) : leads.length === 0 ? (
					<EmptyState icon={<UserRoundPlus className='h-5 w-5' aria-hidden='true' />} title={t("leads.empty")} />
				) : (
					<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
						{sortedLeads.map((lead) => {
							const isExpanded = expandedNoteId === lead.id

							const isEditing = editingNoteId === lead.id

							const hasNote = Boolean(lead.note && lead.note.trim().length > 0)

							const isNoteLong = hasNote && lead.note!.length > NOTE_PREVIEW_LEN

							const displayName = lead.customerName?.trim() || lead.phone

							const lastActivityAt = lead.status === "closed" && lead.closedAt ? lead.closedAt : lead.createdAt

							const attributedTo =
								lead.status === "closed"
									? (lead.closedBy?.displayName ?? t("common.unknown"))
									: (lead.createdBy?.displayName ?? t("leads.sourceLabel.ai"))

							return (
								<li key={lead.id} className='px-5 py-4'>
									<div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4'>
										{/* Avatar */}
										<div
											className={cn(
												"flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
												avatarColorOf(displayName)
											)}>
											{initialsOf(displayName)}
										</div>

										{/* Main content */}
										<div className='min-w-0 flex-1'>
											<div className='flex flex-wrap items-baseline gap-x-2'>
												<p dir={textDirOf(displayName)} className='text-sm font-semibold text-ink-900 dark:text-ink-50'>
													{displayName}
												</p>
											</div>
											<p dir='ltr' className='text-xs text-ink-500 dark:text-ink-400'>
												{lead.phone}
											</p>

											<div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
												<SourceBadge source={lead.source} />
												<StatusBadge status={lead.status} />
											</div>

											{/* Service on its own line, note on its own line below */}
											{!isEditing && (
												<div className='mt-2'>
													<p
														dir={textDirOf(lead.serviceName)}
														className='text-sm font-medium text-ink-900 dark:text-ink-100'>
														{lead.serviceName}
													</p>

													{hasNote && (
														<p dir={textDirOf(lead.note!)} className='mt-1 text-sm text-ink-600 dark:text-ink-300'>
															<span className='font-medium text-ink-400 dark:text-ink-500'>{t("leads.note")}: </span>
															{isExpanded || !isNoteLong ? lead.note : `${lead.note!.slice(0, NOTE_PREVIEW_LEN)}…`}
															{isNoteLong && (
																<button
																	type='button'
																	onClick={() => toggleNote(lead.id)}
																	className='ms-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300'>
																	{isExpanded ? t("leads.showLess") : t("leads.showMore")}
																</button>
															)}
														</p>
													)}
												</div>
											)}

											<div className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400 dark:text-ink-500'>
												<span className='inline-flex items-center gap-1'>
													<Calendar className='h-3 w-3' aria-hidden='true' />
													{t("leads.createdAt")}: {formatDateTime(lead.createdAt)}
												</span>
												<span className='inline-flex items-center gap-1'>
													<RotateCcw className='h-3 w-3' aria-hidden='true' />
													{t("leads.lastActivity")}: {formatDateTime(lastActivityAt)}
												</span>
												<span className='inline-flex items-center gap-1'>
													<UserRound className='h-3 w-3' aria-hidden='true' />
													{t("leads.by")}: {attributedTo}
												</span>
											</div>
										</div>

										{/* Actions */}
										<div className='flex shrink-0 items-center gap-2 self-start'>
											<button
												type='button'
												className='btn-primary px-3 py-1.5 text-xs'
												onClick={() => router.push(`/conversations?id=${lead.conversationId}`)}>
												<MessageSquare className='h-3.5 w-3.5' aria-hidden='true' />
												{t("leads.viewChat")}
											</button>

											{isAdmin && lead.status === "open" && (
												<button
													type='button'
													className='btn-secondary px-3 py-1.5 text-xs'
													disabled={busyLeadId === lead.id}
													onClick={() => setClosingLead(lead)}>
													{busyLeadId === lead.id ? <Spinner /> : null}
													{t("leads.close")}
												</button>
											)}

											{isAdmin && lead.status === "closed" && (
												<button
													type='button'
													className='btn-secondary px-3 py-1.5 text-xs'
													disabled={busyLeadId === lead.id}
													onClick={() => void reopenLead(lead)}>
													{busyLeadId === lead.id ? <Spinner /> : null}
													{t("leads.reopen")}
												</button>
											)}

											{isAdmin && (
												<div className='relative' ref={menuOpenId === lead.id ? menuRef : undefined}>
													<button
														type='button'
														onClick={() => setMenuOpenId((current) => (current === lead.id ? null : lead.id))}
														className='btn-ghost px-1.5 py-1.5'
														aria-label={t("common.edit")}>
														<MoreVertical className='h-4 w-4' aria-hidden='true' />
													</button>

													{menuOpenId === lead.id && (
														<div className='absolute end-0 z-10 mt-1 w-40 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-800'>
															<button
																type='button'
																onClick={() => startEditNote(lead)}
																className='flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700'>
																<FileText className='h-3.5 w-3.5' aria-hidden='true' />
																{t("leads.editNote")}
															</button>
														</div>
													)}
												</div>
											)}
										</div>
									</div>

									{/* Full note / edit panel */}
									{(isExpanded && hasNote && !isEditing) || isEditing ? (
										<div className='mt-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3 dark:border-ink-700 dark:bg-ink-800/30 sm:ms-[3.75rem]'>
											<div className='mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500 dark:text-ink-400'>
												<FileText className='h-3.5 w-3.5' aria-hidden='true' />
												{t("leads.fullNote")}
											</div>

											{isEditing ? (
												<div className='flex flex-col gap-2'>
													<textarea
														value={noteDraft}
														onChange={(e) => setNoteDraft(e.target.value)}
														rows={3}
														placeholder={t("leads.notePlaceholder")}
														className='input w-full resize-none'
													/>
													<div className='flex justify-end gap-2'>
														<button type='button' onClick={cancelEditNote} className='btn-ghost px-2.5 py-1 text-xs'>
															<X className='h-3.5 w-3.5' aria-hidden='true' />
															{t("common.cancel")}
														</button>
														<button
															type='button'
															disabled={savingNote}
															onClick={() => void saveNote(lead)}
															className='btn-primary px-2.5 py-1 text-xs'>
															{savingNote ? <Spinner /> : <Check className='h-3.5 w-3.5' aria-hidden='true' />}
															{t("leads.saveNote")}
														</button>
													</div>
												</div>
											) : (
												<p
													dir={textDirOf(lead.note!)}
													className='whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-300'>
													{lead.note}
												</p>
											)}
										</div>
									) : null}
								</li>
							)
						})}
					</ul>
				)}

				{/* Pagination — same style as Activity Log */}
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
							{t("activity.page", { page: page + 1, total: totalPages })}
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
		</AppShell>
	)
}
