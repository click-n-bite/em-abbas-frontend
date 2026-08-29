"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { useNotifications } from "@/providers/notifications-provider"
import { Spinner } from "@/components/ui/spinner"

export function NotificationBell() {
	const { t, formatRelative } = useI18n()

	const { items, unread, loading, markRead, markAllRead } = useNotifications()

	const [open, setOpen] = useState(false)

	const wrapper = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return

		const onPointerDown = (event: MouseEvent) => {
			if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
		}

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false)
		}

		document.addEventListener("mousedown", onPointerDown)
		document.addEventListener("keydown", onKey)

		return () => {
			document.removeEventListener("mousedown", onPointerDown)
			document.removeEventListener("keydown", onKey)
		}
	}, [open])

	const latest = items.slice(0, 5)

	return (
		<div ref={wrapper} className='relative'>
			<button
				type='button'
				onClick={() => setOpen((value) => !value)}
				aria-haspopup='menu'
				aria-expanded={open}
				aria-label={t("nav.notifications")}
				className='relative rounded-xl border border-ink-200 bg-white p-2 text-ink-600 transition hover:bg-ink-100 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'>
				<Bell className='h-4 w-4' aria-hidden='true' />
				{unread > 0 ? (
					<span className='absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold tabular-nums text-white'>
						{unread > 9 ? "9+" : unread}
					</span>
				) : null}
			</button>

			{open ? (
				<div className='absolute end-0 z-50 mt-2 w-80 animate-fade-in overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-800'>
					<div className='flex items-center justify-between gap-2 border-b border-ink-200 px-4 py-3 dark:border-ink-700'>
						<div>
							<p className='text-sm font-semibold text-ink-800 dark:text-ink-100'>{t("notifications.title")}</p>
							<p className='text-xs text-ink-500 dark:text-ink-400'>{t("notifications.unreadCount", { n: unread })}</p>
						</div>
						{unread > 0 ? (
							<button type='button' onClick={() => void markAllRead()} className='btn-ghost px-2 py-1 text-xs'>
								<CheckCheck className='h-3.5 w-3.5' aria-hidden='true' />
								{t("notifications.markAllRead")}
							</button>
						) : null}
					</div>

					<div className='max-h-80 overflow-y-auto'>
						{loading && latest.length === 0 ? (
							<div className='flex items-center justify-center gap-2 p-6 text-sm text-ink-500'>
								<Spinner />
								{t("common.loading")}
							</div>
						) : latest.length === 0 ? (
							<p className='p-6 text-center text-sm text-ink-500 dark:text-ink-400'>{t("notifications.empty")}</p>
						) : (
							<ul className='divide-y divide-ink-100 dark:divide-ink-700'>
								{latest.map((item) => {
									const href = item.conversationId
										? `/conversations?id=${encodeURIComponent(item.conversationId)}`
										: "/notifications"

									return (
										<li key={item.id}>
											<Link
												href={href}
												onClick={() => {
													if (!item.read) void markRead(item.id)

													setOpen(false)
												}}
												className='flex gap-3 px-4 py-3 transition hover:bg-ink-50 dark:hover:bg-ink-700/60'>
												<span
													className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
														item.read ? "bg-transparent" : "bg-brand-500"
													}`}
													aria-hidden='true'
												/>
												<span className='min-w-0 flex-1'>
													<span className='block truncate text-sm font-medium text-ink-800 dark:text-ink-100'>
														{item.title}
													</span>
													<span className='block truncate text-xs text-ink-500 dark:text-ink-400'>
														{item.body ?? item.preview ?? item.phone ?? ""}
													</span>
													<span className='mt-0.5 block text-[11px] text-ink-400'>
														{formatRelative(item.createdAt)}
													</span>
												</span>
											</Link>
										</li>
									)
								})}
							</ul>
						)}
					</div>

					<Link
						href='/notifications'
						onClick={() => setOpen(false)}
						className='block border-t border-ink-200 px-4 py-2.5 text-center text-xs font-medium text-brand-700 hover:bg-ink-50 dark:border-ink-700 dark:text-brand-200 dark:hover:bg-ink-700/60'>
						{t("nav.notifications")}
					</Link>
				</div>
			) : null}
		</div>
	)
}
