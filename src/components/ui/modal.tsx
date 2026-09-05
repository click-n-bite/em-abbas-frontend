"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"

interface Props {
	open: boolean
	title: string
	description?: string
	onClose: () => void
	children: ReactNode
	footer?: ReactNode
	size?: "sm" | "md" | "lg"
}

const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const

export function Modal({ open, title, description, onClose, children, footer, size = "md" }: Props) {
	const { t } = useI18n()

	const panelRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}

		document.addEventListener("keydown", onKeyDown)
		const previous = document.body.style.overflow

		document.body.style.overflow = "hidden"
		panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus()

		return () => {
			document.removeEventListener("keydown", onKeyDown)
			document.body.style.overflow = previous
		}
	}, [open, onClose])

	if (!open) return null

	return (
		<div className='fixed inset-0 z-50 flex !mt-0 items-end justify-center bg-ink-900/50 p-4 backdrop-blur-sm sm:items-center'>
			<button
				type='button'
				aria-label={t("common.close")}
				className='absolute inset-0 cursor-default'
				onClick={onClose}
			/>
			<div
				ref={panelRef}
				role='dialog'
				aria-modal='true'
				aria-label={title}
				className={`relative z-10 w-full ${widths[size]} animate-fade-in rounded-2xl border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-800`}>
				<header className='flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4 dark:border-ink-700'>
					<div>
						<h2 className='text-base font-semibold text-ink-900 dark:text-ink-50'>{title}</h2>
						{description ? <p className='mt-1 text-sm text-ink-500 dark:text-ink-400'>{description}</p> : null}
					</div>
					<button
						type='button'
						onClick={onClose}
						aria-label={t("common.close")}
						className='rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100'>
						<X className='h-4 w-4' aria-hidden='true' />
					</button>
				</header>

				<div className='max-h-[70vh] overflow-y-auto px-5 py-4'>{children}</div>

				{footer ? (
					<footer className='flex flex-wrap justify-end gap-2 border-t border-ink-200 px-5 py-4 dark:border-ink-700'>
						{footer}
					</footer>
				) : null}
			</div>
		</div>
	)
}
