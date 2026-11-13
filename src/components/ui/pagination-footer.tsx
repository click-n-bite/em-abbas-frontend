"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Select } from "@/components/ui/select"
import { useI18n } from "@/providers/i18n-provider"
import { cn } from "@/lib/utils"

function pageNumbers(current: number, total: number): (number | "gap")[] {
	if (total <= 7) return Array.from({ length: total }, (_, index) => index)

	const items: (number | "gap")[] = [0]

	const start = Math.max(1, current - 1)

	const end = Math.min(total - 2, current + 1)

	if (start > 1) items.push("gap")

	for (let i = start; i <= end; i++) items.push(i)

	if (end < total - 2) items.push("gap")

	items.push(total - 1)

	return items
}

interface Props {
	/** Zero-based page index. */
	page: number
	pageSize: number
	pageSizeOptions: number[]
	/** Total rows across all pages. */
	total: number
	/** Names the page navigation for screen readers. */
	ariaLabel: string
	onPageChange: (page: number) => void
	/** Parents should also return to the first page when this fires. */
	onPageSizeChange: (size: number) => void
}

/** Table footer: rows per page, visible range, and numbered pages. */
export function PaginationFooter({
	page,
	pageSize,
	pageSizeOptions,
	total,
	ariaLabel,
	onPageChange,
	onPageSizeChange
}: Props) {
	const { t } = useI18n()

	const totalPages = Math.max(1, Math.ceil(total / pageSize))

	return (
		<footer className='flex shrink-0 items-center justify-between gap-2 border-t border-ink-200 px-3 py-2.5 dark:border-ink-700 sm:px-5 lg:py-2'>
			<div className='flex min-w-0 items-center gap-3'>
				<div className='flex items-center gap-2'>
					<span className='hidden whitespace-nowrap text-xs text-ink-500 dark:text-ink-400 lg:inline'>
						{t("leads.rowsPerPage")}
					</span>
					<Select
						value={String(pageSize)}
						onChange={(event) => onPageSizeChange(Number(event.target.value))}
						className='h-9 min-w-0 py-0 pe-8 ps-2 lg:h-8 lg:!text-sm'
						wrapperClassName='w-auto flex-none'
						mobileLabel={String(pageSize)}
						aria-label={t("leads.rowsPerPage")}>
						{pageSizeOptions.map((size) => (
							<option key={size} value={size}>
								{size}
							</option>
						))}
					</Select>
				</div>

				{/* <span className="hidden whitespace-nowrap text-xs tabular-nums text-ink-500 dark:text-ink-400 sm:inline">
          {t("common.pageRange", {
            start: page * pageSize + 1,
            end: Math.min((page + 1) * pageSize, total),
            total,
          })}
        </span> */}
			</div>

			{totalPages > 1 ? (
				<nav aria-label={ariaLabel} className='flex shrink-0 items-center gap-1'>
					<button
						type='button'
						className='btn-ghost h-9 w-9 p-0 sm:h-8 sm:w-8'
						disabled={page === 0}
						onClick={() => onPageChange(Math.max(0, page - 1))}
						aria-label={t("common.previous")}>
						<ChevronLeft className='h-4 w-4 rtl:rotate-180' aria-hidden='true' />
					</button>

					{/* Mobile: compact "2 / 6" indicator */}
					<span
						dir='ltr'
						className='min-w-12 text-center text-xs font-medium tabular-nums text-ink-600 dark:text-ink-300 sm:hidden'
						aria-live='polite'>
						{page + 1} / {totalPages}
					</span>

					{/* sm and up: numbered page buttons */}
					<div className='hidden items-center gap-1 sm:flex'>
						{pageNumbers(page, totalPages).map((item, index) =>
							item === "gap" ? (
								<span key={`gap-${index}`} className='px-1 text-xs text-ink-400' aria-hidden='true'>
									…
								</span>
							) : (
								<button
									key={item}
									type='button'
									onClick={() => onPageChange(item)}
									aria-current={item === page ? "page" : undefined}
									className={cn(
										"h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular-nums transition",
										item === page
											? "bg-brand-600 text-white shadow-sm"
											: "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700"
									)}>
									{item + 1}
								</button>
							)
						)}
					</div>

					<button
						type='button'
						className='btn-ghost h-9 w-9 p-0 sm:h-8 sm:w-8'
						disabled={page + 1 >= totalPages}
						onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
						aria-label={t("common.next")}>
						<ChevronRight className='h-4 w-4 rtl:rotate-180' aria-hidden='true' />
					</button>
				</nav>
			) : null}
		</footer>
	)
}
