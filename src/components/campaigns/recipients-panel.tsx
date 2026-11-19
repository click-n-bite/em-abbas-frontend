"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCheck, FilterX, Layers, RefreshCw, Search, Upload, Users, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useI18n } from "@/providers/i18n-provider"
import { useToast } from "@/providers/toast-provider"
import { Avatar } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { PaginationFooter } from "@/components/ui/pagination-footer"

import { contactsApi } from "@/lib/features/contacts/api"
import type { Contact } from "@/lib/features/contacts/types"
import { parseContactsCsv } from "@/lib/features/campaigns/mock"
import type { CampaignContact } from "@/lib/features/campaigns/types"
import { cn, textDirOf } from "@/lib/utils"

type Tab = "existing" | "segments" | "import"

const PAGE_SIZE_OPTIONS = [5, 10, 25]

interface Props {
	contacts: CampaignContact[]
	selectedIds: Set<string>
	onSelectedChange: (next: Set<string>) => void
	onImport: (contacts: CampaignContact[]) => void
}

interface NormalizedPage {
	contacts: CampaignContact[]
	total: number
}

function asRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const value = record[key]

		if (typeof value === "string" || typeof value === "number") {
			const result = String(value).trim()

			if (result) return result
		}
	}

	return ""
}

function normalizeContact(contact: Contact): CampaignContact {
	const record = asRecord(contact)

	const id = firstString(record, ["id", "contactId", "uuid"])

	const name =
		firstString(record, ["name", "fullName", "displayName"]) ||
		[record.firstName, record.lastName]
			.filter((value): value is string => typeof value === "string")
			.join(" ")
			.trim()

	const phone =
		firstString(record, ["phone", "phoneNumber", "mobile", "mobileNumber"]) ||
		(Array.isArray(record.phones) ? firstString(asRecord(record.phones[0]), ["phone"]) : "")

	const rawTags = record.tags

	const tags = Array.isArray(rawTags)
		? rawTags
				.filter((tag): tag is string => typeof tag === "string")
				.map((tag) => tag.trim())
				.filter(Boolean)
		: typeof rawTags === "string"
			? rawTags
					.split(",")
					.map((tag) => tag.trim())
					.filter(Boolean)
			: []

	return {
		id: id || phone || `${name}-${Math.random().toString(36).slice(2)}`,
		name: name || "Unknown contact",
		phone,
		tags
	}
}

function normalizePage(result: Awaited<ReturnType<typeof contactsApi.list>>): NormalizedPage {
	const record = asRecord(result)

	const items = Array.isArray(record.items) ? (record.items as Contact[]) : []

	const totalValue = record.totalElements ?? record.total ?? record.totalCount ?? record.count

	const total = typeof totalValue === "number" ? totalValue : items.length

	return {
		contacts: items.map(normalizeContact),
		total
	}
}

export function RecipientsPanel({ contacts, selectedIds, onSelectedChange, onImport }: Props) {
	const { t } = useI18n()

	const { push } = useToast()

	const fileInput = useRef<HTMLInputElement>(null)

	const [tab, setTab] = useState<Tab>("existing")

	const [search, setSearch] = useState("")

	const [activeTags, setActiveTags] = useState<string[]>([])

	const [dragging, setDragging] = useState(false)

	const [page, setPage] = useState(0)

	const [pageSize, setPageSize] = useState(10)

	const [apiContacts, setApiContacts] = useState<CampaignContact[]>([])

	const [apiTotal, setApiTotal] = useState(0)

	const [loading, setLoading] = useState(false)

	const [loadError, setLoadError] = useState(false)

	const [refreshKey, setRefreshKey] = useState(0)

	// Load real contacts from the backend.
	useEffect(() => {
		if (tab !== "existing" && tab !== "segments") return

		const controller = new AbortController()

		let active = true

		const loadContacts = async () => {
			try {
				setLoading(true)
				setLoadError(false)

				const result = await contactsApi.list(
					{
						search: search.trim() || undefined,
						page,
						size: pageSize
					},
					controller.signal
				)

				if (!active) return

				const normalized = normalizePage(result)

				setApiContacts(normalized.contacts)
				setApiTotal(normalized.total)
			} catch (error) {
				if (!active || controller.signal.aborted) return

				console.error("Failed to load campaign contacts:", error)
				setLoadError(true)
				setApiContacts([])
				setApiTotal(0)
			} finally {
				if (active && !controller.signal.aborted) {
					setLoading(false)
				}
			}
		}

		void loadContacts()

		return () => {
			active = false
			controller.abort()
		}
	}, [tab, search, page, pageSize, refreshKey])

	const allTags = useMemo(
		() => [...new Set([...contacts, ...apiContacts].flatMap((contact) => contact.tags))],
		[contacts, apiContacts]
	)

	const localFiltered = useMemo(() => {
		const needle = search.trim().toLowerCase()

		return contacts.filter((contact) => {
			if (activeTags.length > 0 && !contact.tags.some((tag) => activeTags.includes(tag))) {
				return false
			}

			return !needle || contact.name.toLowerCase().includes(needle) || contact.phone.includes(needle)
		})
	}, [contacts, search, activeTags])

	const serverFiltered = useMemo(
		() =>
			apiContacts.filter((contact) => activeTags.length === 0 || contact.tags.some((tag) => activeTags.includes(tag))),
		[apiContacts, activeTags]
	)

	const isServerTab = tab === "existing" || tab === "segments"

	const showTable = isServerTab || (tab === "import" && contacts.length > 0)

	const displayedContacts = isServerTab ? serverFiltered : localFiltered.slice(page * pageSize, (page + 1) * pageSize)

	const displayedTotal = isServerTab ? apiTotal : localFiltered.length

	const totalPages = Math.max(1, Math.ceil(displayedTotal / pageSize))

	const currentPage = Math.min(page, totalPages - 1)

	const allSelected = displayedContacts.length > 0 && displayedContacts.every((contact) => selectedIds.has(contact.id))

	const selectedOnPage = displayedContacts.filter((contact) => selectedIds.has(contact.id)).length

	const toggleOne = (id: string) => {
		const next = new Set(selectedIds)

		if (next.has(id)) next.delete(id)
		else next.add(id)

		onSelectedChange(next)
	}

	const toggleAll = () => {
		const next = new Set(selectedIds)

		displayedContacts.forEach((contact) => {
			if (allSelected) next.delete(contact.id)
			else next.add(contact.id)
		})

		onSelectedChange(next)
	}

	const toggleTag = (tag: string) => {
		setActiveTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]))

		setPage(0)
	}

	const selectTag = (tag: string) => {
		const next = new Set(selectedIds)

		const matching = [...contacts, ...apiContacts].filter((contact) => contact.tags.includes(tag))

		matching.forEach((contact) => next.add(contact.id))
		onSelectedChange(next)

		push(`Selected ${matching.length} contacts`, "success")
	}

	const clearSelection = () => onSelectedChange(new Set())

	const clearFilters = () => {
		setActiveTags([])
		setSearch("")
		setPage(0)
	}

	const handleFile = async (file: File | undefined) => {
		if (!file) return

		if (file.size > 10 * 1024 * 1024) {
			push(t("campaigns.recipients.tooLarge"), "error")

			return
		}

		if (!file.name.toLowerCase().endsWith(".csv")) {
			push(t("campaigns.recipients.csvOnly"), "error")

			return
		}

		try {
			const imported = parseContactsCsv(await file.text())

			if (imported.length === 0) {
				push(t("campaigns.recipients.noRows"), "error")

				return
			}

			onImport(imported)

			const next = new Set(selectedIds)

			imported.forEach((contact) => next.add(contact.id))
			onSelectedChange(next)

			push(t("campaigns.recipients.imported", { n: imported.length }), "success")
		} catch (error) {
			console.error("CSV import failed:", error)
			push(t("campaigns.recipients.noRows"), "error")
		}
	}

	const startItem = displayedTotal === 0 ? 0 : page * pageSize + 1

	const endItem = Math.min((page + 1) * pageSize, displayedTotal)

	const tabs: { value: Tab; label: string; icon: LucideIcon }[] = [
		{ value: "existing", label: t("campaigns.recipients.tabExisting"), icon: Users },
		{ value: "segments", label: t("campaigns.recipients.tabSegments"), icon: Layers },
		{ value: "import", label: t("campaigns.recipients.tabImport"), icon: Upload }
	]

	return (
		<section className='card flex min-h-0 flex-col overflow-hidden'>
			{/* Header */}
			<header className='border-b border-ink-100 p-4 dark:border-ink-700'>
				<div className='flex items-center justify-between gap-3'>
					<div className='flex min-w-0 items-center gap-3'>
						<span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-200'>
							<Users className='h-5 w-5' aria-hidden='true' />
						</span>

						<div className='min-w-0'>
							<h2 className='truncate text-sm font-semibold text-ink-900 dark:text-ink-50'>
								{t("campaigns.recipients.title")}
							</h2>
							<p className='truncate text-xs text-ink-500 dark:text-ink-400'>{t("campaigns.recipients.subtitle")}</p>
						</div>
					</div>

					<div className='flex shrink-0 items-center gap-2'>
						<span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'>
							<CheckCheck className='h-3.5 w-3.5' aria-hidden='true' />
							{t("campaigns.recipients.selected", { n: selectedIds.size })}
						</span>

						{isServerTab && (
							<button
								type='button'
								onClick={() => setRefreshKey((value) => value + 1)}
								disabled={loading}
								aria-label='Refresh contacts'
								className='flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 text-ink-500 transition hover:bg-ink-50 disabled:opacity-50 dark:border-ink-700 dark:hover:bg-ink-800'>
								<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
							</button>
						)}
					</div>
				</div>

				{/* Tabs */}
				<div
					role='tablist'
					aria-label={t("campaigns.recipients.title")}
					className='mt-4 grid grid-cols-3 gap-1 rounded-xl bg-ink-100/80 p-1 dark:bg-ink-800'>
					{tabs.map(({ value, label, icon: Icon }) => {
						const active = tab === value

						return (
							<button
								key={value}
								type='button'
								role='tab'
								aria-selected={active}
								onClick={() => {
									setTab(value)
									setPage(0)
								}}
								className={cn(
									"flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
									active
										? "bg-white text-brand-700 shadow-sm dark:bg-ink-900 dark:text-brand-200"
										: "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
								)}>
								<Icon className='h-4 w-4 shrink-0' aria-hidden='true' />
								<span className='truncate'>{label}</span>
							</button>
						)
					})}
				</div>
			</header>

			<div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
				{/* CSV Import */}
				{tab === "import" && (
					<div
						onDragOver={(event) => {
							event.preventDefault()
							setDragging(true)
						}}
						onDragLeave={() => setDragging(false)}
						onDrop={(event) => {
							event.preventDefault()
							setDragging(false)
							void handleFile(event.dataTransfer.files[0])
						}}
						className={cn(
							"flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition",
							dragging
								? "border-brand-400 bg-brand-50 dark:bg-brand-900/20"
								: "border-ink-200 bg-ink-50/50 dark:border-ink-700 dark:bg-ink-900/20"
						)}>
						<span className='flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200'>
							<Upload className='h-6 w-6' aria-hidden='true' />
						</span>

						<p className='text-sm font-semibold text-ink-900 dark:text-ink-50'>
							{t("campaigns.recipients.uploadTitle")}
						</p>

						<p className='max-w-xs text-xs text-ink-500 dark:text-ink-400'>{t("campaigns.recipients.uploadHint")}</p>

						<input
							ref={fileInput}
							type='file'
							accept='.csv'
							className='hidden'
							onChange={(event) => {
								void handleFile(event.target.files?.[0])
								event.target.value = ""
							}}
						/>

						<button type='button' className='btn-secondary mt-1' onClick={() => fileInput.current?.click()}>
							<Upload className='h-4 w-4' />
							{t("campaigns.recipients.chooseFile")}
						</button>

						<p className='text-[11px] text-ink-400'>{t("campaigns.recipients.formats")}</p>
					</div>
				)}

				{/* Search + filters */}
				{tab === "existing" && (
					<div className='space-y-3'>
						<div className='flex gap-2'>
							<div className='relative min-w-0 flex-1'>
								<Search className='pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400' />

								<input
									value={search}
									onChange={(event) => {
										setSearch(event.target.value)
										setPage(0)
									}}
									placeholder={t("campaigns.recipients.searchPlaceholder")}
									aria-label={t("common.search")}
									className='input h-10 ps-9'
								/>
							</div>

							{(search || activeTags.length > 0) && (
								<button type='button' onClick={clearFilters} className='btn-secondary shrink-0'>
									<FilterX className='h-4 w-4' />
									{t("campaigns.recipients.clearFilters")}
								</button>
							)}
						</div>

						{allTags.length > 0 && (
							<div className='flex flex-wrap items-center gap-2'>
								<span className='text-xs font-medium text-ink-500 dark:text-ink-400'>
									{t("campaigns.recipients.filterBy")}
								</span>

								{allTags.map((tag) => {
									const active = activeTags.includes(tag)

									return (
										<button
											key={tag}
											type='button'
											aria-pressed={active}
											onClick={() => toggleTag(tag)}
											className={cn(
												"inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
												active
													? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
													: "border-ink-200 bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400"
											)}>
											{tag}
											{active && <X className='h-3 w-3' />}
										</button>
									)
								})}
							</div>
						)}
					</div>
				)}

				{/* Segments */}
				{tab === "segments" && (
					<div className='space-y-2'>
						<p className='text-xs font-medium text-ink-500 dark:text-ink-400'>{t("campaigns.recipients.filterBy")}</p>

						<div className='grid gap-2 sm:grid-cols-1'>
							{allTags.map((tag) => {
								const count = [...contacts, ...apiContacts].filter((contact) => contact.tags.includes(tag)).length

								return (
									<div
										key={tag}
										className='flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3 transition hover:border-brand-300 dark:border-ink-700 dark:bg-ink-900/40'>
										<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200'>
											<Layers className='h-4 w-4' />
										</span>

										<div className='min-w-0 flex-1'>
											<p className='truncate text-sm font-semibold text-ink-900 dark:text-ink-50'>{tag}</p>
											<p className='text-xs text-ink-500 dark:text-ink-400'>{count} contacts on loaded pages</p>
										</div>

										<button type='button' className='btn-secondary px-3 py-1.5 text-xs' onClick={() => selectTag(tag)}>
											{t("campaigns.recipients.selectSegment")}
										</button>
									</div>
								)
							})}

							{allTags.length === 0 && (
								<p className='col-span-full rounded-xl bg-ink-50 p-4 text-center text-sm text-ink-500 dark:bg-ink-800'>
									No segments available.
								</p>
							)}
						</div>
					</div>
				)}

				{/* Contacts table */}
				{showTable && (
					<div className='overflow-hidden rounded-2xl border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900/40'>
						{/* Table toolbar */}
						<div className='flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/70 px-4 py-3 dark:border-ink-700 dark:bg-ink-800/50'>
							<p className='text-sm text-ink-600 dark:text-ink-300'>
								<span className='font-semibold text-ink-900 dark:text-ink-50'>{displayedTotal}</span> contacts
								{selectedOnPage > 0 && <span className='text-ink-400'> · {selectedOnPage} selected on this page</span>}
							</p>

							<div className='flex items-center gap-3'>
								{displayedContacts.length > 0 && (
									<button
										type='button'
										onClick={toggleAll}
										className='text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300'>
										{allSelected ? "Deselect page" : t("campaigns.recipients.selectAll")}
									</button>
								)}

								{selectedIds.size > 0 && (
									<button
										type='button'
										onClick={clearSelection}
										className='text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300'>
										Clear selection
									</button>
								)}
							</div>
						</div>

						{loading ? (
							<div className='flex min-h-52 flex-col items-center justify-center gap-3'>
								<RefreshCw className='h-6 w-6 animate-spin text-brand-600' />
								<p className='text-sm text-ink-500 dark:text-ink-400'>Loading contacts...</p>
							</div>
						) : loadError && isServerTab ? (
							<div className='flex min-h-52 flex-col items-center justify-center gap-3 p-5 text-center'>
								<span className='flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'>
									<AlertCircle className='h-5 w-5' />
								</span>

								<div>
									<p className='text-sm font-semibold text-ink-900 dark:text-ink-50'>Unable to load contacts</p>
									<p className='mt-1 text-xs text-ink-500 dark:text-ink-400'>
										Please check your connection and try again.
									</p>
								</div>

								<button type='button' className='btn-secondary' onClick={() => setRefreshKey((value) => value + 1)}>
									<RefreshCw className='h-4 w-4' />
									Try again
								</button>
							</div>
						) : displayedContacts.length === 0 ? (
							<div className='p-5'>
								<EmptyState icon={<Users className='h-5 w-5' />} title={t("campaigns.recipients.empty")} />
							</div>
						) : (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[420px] border-collapse text-sm'>
									<thead className='bg-ink-50/50 dark:bg-ink-800/30'>
										<tr className='border-b border-ink-200 text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:border-ink-700 dark:text-ink-400'>
											<th className='w-12 px-4 py-2.5 text-start'>
												<input
													type='checkbox'
													checked={allSelected}
													onChange={toggleAll}
													aria-label={t("campaigns.recipients.selectAll")}
													className='h-4 w-4 rounded border-ink-300 accent-brand-600'
												/>
											</th>

											<th className='px-4 py-2.5 text-start'>{t("campaigns.recipients.colName")}</th>

											<th className='px-4 py-2.5 text-start'>{t("campaigns.recipients.colPhone")}</th>
										</tr>
									</thead>

									<tbody className='divide-y divide-ink-100 dark:divide-ink-700/70'>
										{displayedContacts.map((contact) => {
											const selected = selectedIds.has(contact.id)

											return (
												<tr
													key={contact.id}
													onClick={() => toggleOne(contact.id)}
													className={cn(
														"cursor-pointer transition-colors",
														selected
															? "bg-brand-50/60 dark:bg-brand-900/10"
															: "hover:bg-ink-50/70 dark:hover:bg-ink-800/40"
													)}>
													<td className='px-4 py-3' onClick={(event) => event.stopPropagation()}>
														<input
															type='checkbox'
															checked={selected}
															onChange={() => toggleOne(contact.id)}
															aria-label={contact.name}
															className='h-4 w-4 rounded border-ink-300 accent-brand-600'
														/>
													</td>

													<td className='px-4 py-3'>
														<div className='flex min-w-0 items-center gap-3'>
															<Avatar name={contact.name} seed={contact.id} />

															<p
																dir={textDirOf(contact.name)}
																className='truncate font-semibold text-ink-900 dark:text-ink-50'>
																{contact.name}
															</p>
														</div>
													</td>

													<td
														dir='ltr'
														className='whitespace-nowrap px-4 py-3 text-start text-xs font-medium text-ink-600 dark:text-ink-300'>
														{contact.phone || "—"}
													</td>
												</tr>
											)
										})}
									</tbody>
								</table>
							</div>
						)}

						{/* Table footer */}
						{!loading && !loadError && displayedContacts.length > 0 && (
							<div className='flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 bg-ink-50/50 px-4 py-2.5 dark:border-ink-700 dark:bg-ink-800/30'>
								<p className='text-xs text-ink-500 dark:text-ink-400'>
									Showing{" "}
									<span className='font-semibold text-ink-800 dark:text-ink-100'>
										{startItem}–{endItem}
									</span>{" "}
									of <span className='font-semibold text-ink-800 dark:text-ink-100'>{displayedTotal}</span>
								</p>

								<p className='text-xs text-ink-500 dark:text-ink-400'>{selectedIds.size} selected in total</p>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Pagination */}
			{showTable &&
				!loading &&
				!loadError &&
				displayedTotal > 0 &&
				(isServerTab || localFiltered.length > pageSize) && (
					<PaginationFooter
						page={currentPage}
						pageSize={pageSize}
						pageSizeOptions={PAGE_SIZE_OPTIONS}
						total={displayedTotal}
						ariaLabel={t("campaigns.recipients.title")}
						onPageChange={setPage}
						onPageSizeChange={(size) => {
							setPageSize(size)
							setPage(0)
						}}
					/>
				)}
		</section>
	)
}
