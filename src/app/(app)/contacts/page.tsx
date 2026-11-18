"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BookUser, Plus, RefreshCw } from "lucide-react"
import { contactsApi } from "@/lib/features/contacts/api"
import { formatContactPhone } from "@/lib/features/contacts/format"
import type { ContactSortField, ContactSummary } from "@/lib/features/contacts/types"
import { errorKey } from "@/lib/errors"
import { useI18n } from "@/providers/i18n-provider"
import { AppShell } from "@/components/layout/app-shell"
import { Avatar } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterBar, FilterTabs } from "@/components/ui/filter-bar"
import { PaginationFooter } from "@/components/ui/pagination-footer"
import { Select } from "@/components/ui/select"
import { ContactFormModal } from "@/components/contacts/contact-form-modal"
import { TrustedStar } from "@/components/contacts/trusted-star"
import { cn, textDirOf } from "@/lib/utils"

type TrustedFilter = "all" | "trusted" | "notTrusted"

type LinkedFilter = "all" | "linked" | "unlinked"

type SortKey = "nameAsc" | "nameDesc" | "updatedDesc" | "createdDesc"

const SORTS: Record<SortKey, { sort: ContactSortField; direction: "asc" | "desc" }> = {
	nameAsc: { sort: "name", direction: "asc" },
	nameDesc: { sort: "name", direction: "desc" },
	updatedDesc: { sort: "updatedAt", direction: "desc" },
	createdDesc: { sort: "createdAt", direction: "desc" }
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const DEFAULT_PAGE_SIZE = 25

function PhonesCell({ contact }: { contact: ContactSummary }) {
	const { t } = useI18n()

	if (contact.phones.length === 0) {
		return <span className='text-xs text-ink-400'>{t("contacts.noPhones")}</span>
	}

	const [first, ...rest] = contact.phones

	return (
		<span dir='ltr' className='text-xs text-ink-700 dark:text-ink-200'>
			{formatContactPhone(first.phone)}
			{first.label ? <span className='text-ink-400'> · {first.label}</span> : null}
			{rest.length > 0 ? <span className='ms-1 text-ink-400'>+{rest.length}</span> : null}
		</span>
	)
}

export default function ContactsPage() {
	const router = useRouter()

	const { t, formatDateTime } = useI18n()

	const [items, setItems] = useState<ContactSummary[]>([])

	const [total, setTotal] = useState(0)

	const [page, setPage] = useState(0)

	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

	const [loading, setLoading] = useState(true)

	const [failure, setFailure] = useState<string | null>(null)

	const [searchInput, setSearchInput] = useState("")

	const [search, setSearch] = useState("")

	const [trusted, setTrusted] = useState<TrustedFilter>("all")

	const [linked, setLinked] = useState<LinkedFilter>("all")

	const [sortKey, setSortKey] = useState<SortKey>("nameAsc")

	const [formOpen, setFormOpen] = useState(false)

	const loadSeq = useRef(0)

	const loadAbort = useRef<AbortController | null>(null)

	const listRef = useRef<HTMLDivElement | null>(null)

	const tableRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setSearch(searchInput.trim())
			setPage(0)
		}, 300)

		return () => window.clearTimeout(timer)
	}, [searchInput])

	useEffect(() => {
		listRef.current?.scrollTo({ top: 0 })
		tableRef.current?.scrollTo({ top: 0 })
	}, [page, pageSize])

	const load = useCallback(
		async (silent = false) => {
			const seq = ++loadSeq.current

			loadAbort.current?.abort()

			const controller = new AbortController()

			loadAbort.current = controller

			if (!silent) setLoading(true)

			try {
				const result = await contactsApi.list(
					{
						search: search || undefined,
						trusted: trusted === "all" ? undefined : trusted === "trusted",
						linked: linked === "all" ? undefined : linked === "linked",
						...SORTS[sortKey],
						page,
						size: pageSize
					},
					controller.signal
				)

				if (seq !== loadSeq.current) return

				setItems(result.items)
				setTotal(result.total)
				setFailure(null)
			} catch (error) {
				if ((error as Error)?.name === "AbortError") return

				if (seq !== loadSeq.current) return

				setFailure(errorKey(error))
			} finally {
				if (seq === loadSeq.current) setLoading(false)
			}
		},
		[search, trusted, linked, sortKey, page, pageSize]
	)

	useEffect(() => {
		void load()
	}, [load])

	const hasActiveFilters = search !== "" || trusted !== "all" || linked !== "all" || sortKey !== "nameAsc"

	const moreFiltersCount = [linked !== "all", sortKey !== "nameAsc"].filter(Boolean).length

	const clearAll = () => {
		setSearchInput("")
		setSearch("")
		setTrusted("all")
		setLinked("all")
		setSortKey("nameAsc")
		setPage(0)
	}

	const sortOptions = useMemo(
		() =>
			(Object.keys(SORTS) as SortKey[]).map((key) => ({
				key,
				label: t(`contacts.sort.${key}`)
			})),
		[t]
	)

	const open = (contact: ContactSummary) => router.push(`/contacts/${contact.id}`)

	return (
		<AppShell
			title={t("contacts.title")}
			subtitle={failure ? t(failure) : t("contacts.subtitle")}
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
					<button
						type='button'
						className='btn-primary'
						onClick={() => setFormOpen(true)}
						aria-label={t("contacts.new")}
						title={t("contacts.new")}>
						<Plus className='h-4 w-4' aria-hidden='true' />
						<span className='hidden sm:inline'>{t("contacts.new")}</span>
					</button>
				</div>
			}>
			<section className='card flex h-[calc(100dvh-8.5rem)] min-h-[28rem] flex-col overflow-hidden lg:h-full lg:min-h-[24rem]'>
				<FilterBar
					search={searchInput}
					onSearchChange={setSearchInput}
					searchPlaceholder={t("contacts.searchPlaceholder")}
					searchLabel={t("common.search")}
					filtersLabel={t("contacts.moreFilters")}
					activeCount={moreFiltersCount}
					hasActive={hasActiveFilters}
					clearLabel={t("contacts.clearFilters")}
					onClear={clearAll}
					tabs={
						<FilterTabs<TrustedFilter>
							label={t("contacts.title")}
							value={trusted}
							options={[
								{ value: "all", label: t("contacts.filters.all"), count: null },
								{
									value: "trusted",
									label: t("contacts.filters.trusted"),
									count: null
								},
								{
									value: "notTrusted",
									label: t("contacts.filters.notTrusted"),
									count: null
								}
							]}
							onChange={(value) => {
								setTrusted(value)
								setPage(0)
							}}
						/>
					}>
					<Select
						value={linked}
						onChange={(event) => {
							setLinked(event.target.value as LinkedFilter)
							setPage(0)
						}}
						className='h-11 min-w-0 pe-8 ps-2 lg:h-10 lg:pe-10 lg:ps-3'
						wrapperClassName='min-w-0 lg:min-w-[9rem] lg:flex-1'
						mobileLabel={t(`contacts.linkedFilter.${linked}`)}
						aria-label={t("contacts.col.chats")}>
						<option value='all'>{t("contacts.linkedFilter.all")}</option>
						<option value='linked'>{t("contacts.linkedFilter.linked")}</option>
						<option value='unlinked'>{t("contacts.linkedFilter.unlinked")}</option>
					</Select>

					<Select
						value={sortKey}
						onChange={(event) => {
							setSortKey(event.target.value as SortKey)
							setPage(0)
						}}
						className='h-11 min-w-0 pe-8 ps-2 lg:h-10 lg:pe-10 lg:ps-3'
						wrapperClassName='min-w-0 lg:min-w-[11rem] lg:flex-[1.5]'
						mobileLabel={t(`contacts.sort.${sortKey}`)}
						aria-label={t("contacts.sort.label")}>
						{sortOptions.map((option) => (
							<option key={option.key} value={option.key}>
								{option.label}
							</option>
						))}
					</Select>
				</FilterBar>

				<div ref={listRef} className='flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden'>
					{loading && items.length === 0 ? (
						<div className='space-y-2 p-5'>
							{[0, 1, 2].map((index) => (
								<div key={index} className='skeleton h-10 w-full' />
							))}
						</div>
					) : failure && items.length === 0 ? (
						<EmptyState
							icon={<BookUser className='h-5 w-5' aria-hidden='true' />}
							title={t(failure)}
							action={
								<button type='button' className='btn-secondary' onClick={() => void load()}>
									{t("common.retry")}
								</button>
							}
						/>
					) : items.length === 0 ? (
						<EmptyState icon={<BookUser className='h-5 w-5' aria-hidden='true' />} title={t("contacts.empty")} />
					) : (
						<>
							<ul aria-label={t("contacts.title")} className='space-y-2 bg-ink-50/50 p-3 dark:bg-ink-900/20 lg:hidden'>
								{items.map((contact) => (
									<li key={contact.id}>
										<button
											type='button'
											onClick={() => open(contact)}
											className='flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white p-3 text-start dark:border-ink-700 dark:bg-ink-800'>
											<Avatar name={contact.displayName} seed={String(contact.id)} />
											<span className='min-w-0 flex-1'>
												<span
													dir={textDirOf(contact.displayName)}
													className='flex items-center gap-1 text-sm font-semibold text-ink-900 dark:text-ink-50'>
													<span className='truncate'>{contact.displayName}</span>
													{contact.trusted ? <TrustedStar /> : null}
												</span>
												<span className='block'>
													<PhonesCell contact={contact} />
												</span>
												<span className='block text-[11px] text-ink-500 dark:text-ink-400'>
													{t("contacts.chatsCount", {
														n: contact.linkedCustomerCount
													})}
												</span>
											</span>
										</button>
									</li>
								))}
							</ul>

							<div ref={tableRef} className='hidden min-h-0 flex-1 overflow-auto lg:block'>
								<table className='w-full min-w-[48rem] border-collapse text-sm'>
									<thead className='sticky top-0 z-10'>
										<tr className='bg-ink-50 text-xs font-semibold uppercase tracking-wide text-ink-400 shadow-[0_1px_0_0] shadow-ink-200 dark:bg-ink-800 dark:text-ink-500 dark:shadow-ink-700'>
											<th className='px-5 py-2.5 text-start'>{t("contacts.col.name")}</th>
											<th className='px-3 py-2.5 text-start'>{t("contacts.col.phones")}</th>
											<th className='px-3 py-2.5 text-start'>{t("contacts.col.chats")}</th>
											<th className='px-3 py-2.5 text-start'>{t("contacts.col.source")}</th>
											<th className='px-3 py-2.5 text-start'>{t("contacts.col.updated")}</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-ink-100 dark:divide-ink-700/70'>
										{items.map((contact) => (
											<tr
												key={contact.id}
												onClick={() => open(contact)}
												className='cursor-pointer align-middle transition hover:bg-ink-50/60 dark:hover:bg-ink-800/30'>
												<td className='px-5 py-3'>
													<div className='flex items-center gap-2.5'>
														<Avatar name={contact.displayName} seed={String(contact.id)} size='sm' />
														<p
															dir={textDirOf(contact.displayName)}
															className='flex min-w-0 items-center gap-1 text-sm font-semibold text-ink-900 dark:text-ink-50'>
															<span className='truncate'>{contact.displayName}</span>
															{contact.trusted ? <TrustedStar /> : null}
														</p>
													</div>
												</td>
												<td className='px-3 py-3'>
													<PhonesCell contact={contact} />
												</td>
												<td className='px-3 py-3 text-xs tabular-nums text-ink-700 dark:text-ink-200'>
													{contact.linkedCustomerCount}
												</td>
												<td className='px-3 py-3 text-xs text-ink-500 dark:text-ink-400'>
													{t(`contacts.source.${contact.source}`)}
												</td>
												<td className='whitespace-nowrap px-3 py-3 text-xs text-ink-500 dark:text-ink-400'>
													{formatDateTime(contact.updatedAt)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}
				</div>

				{total > 0 ? (
					<PaginationFooter
						page={page}
						pageSize={pageSize}
						pageSizeOptions={PAGE_SIZE_OPTIONS}
						total={total}
						ariaLabel={t("contacts.title")}
						onPageChange={setPage}
						onPageSizeChange={(size) => {
							setPageSize(size)
							setPage(0)
						}}
					/>
				) : null}
			</section>

			<ContactFormModal
				open={formOpen}
				contact={null}
				onClose={() => setFormOpen(false)}
				onSaved={(contact) => {
					void load(true)

					// A brand-new contact opens straight away unless a notice is showing.
					if (!contact.warnings || contact.warnings.length === 0) router.push(`/contacts/${contact.id}`)
				}}
			/>
		</AppShell>
	)
}
