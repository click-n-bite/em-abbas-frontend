"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bell, BellOff, CheckCheck, RefreshCw } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { useNotifications } from "@/providers/notifications-provider"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { ModeBadge } from "@/components/ui/badges"
import { cn } from "@/lib/utils"

export default function NotificationsPage() {
	const { t, formatDateTime, formatRelative } = useI18n()

	const { items, unread, loading, errorKey: failure, refresh, markRead, markAllRead } = useNotifications()

	const [onlyUnread, setOnlyUnread] = useState(false)

	const visible = useMemo(() => (onlyUnread ? items.filter((item) => !item.read) : items), [items, onlyUnread])

	return (
		<AppShell
			title={t("notifications.title")}
			subtitle={failure ? t(failure) : t("notifications.subtitle")}
			actions={
				<div className='flex items-center gap-2'>
					<label className='flex cursor-pointer items-center gap-2 text-sm text-ink-600 dark:text-ink-300'>
						<input
							type='checkbox'
							className='h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 dark:border-ink-600 dark:bg-ink-900'
							checked={onlyUnread}
							onChange={(event) => setOnlyUnread(event.target.checked)}
						/>
						{t("notifications.onlyUnread")}
					</label>
					<button type='button' className='btn-secondary' onClick={() => void markAllRead()} disabled={unread === 0}>
						<CheckCheck className='h-4 w-4' aria-hidden='true' />
						<span className='hidden sm:inline'>{t("notifications.markAllRead")}</span>
					</button>
					<button
						type='button'
						onClick={() => void refresh()}
						className='btn-secondary px-3 py-2'
						aria-label={t("common.refresh")}
						title={t("common.refresh")}>
						<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden='true' />
					</button>
				</div>
			}>
			<section className='card overflow-hidden'>
				<header className='flex items-center gap-2 border-b border-ink-200 px-5 py-3 text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400'>
					<Bell className='h-4 w-4' aria-hidden='true' />
					{t("notifications.unreadCount", { n: unread })}
				</header>

				{loading && items.length === 0 ? (
					<ul className='space-y-3 p-5'>
						{[0, 1, 2, 3].map((index) => (
							<li key={index} className='space-y-2'>
								<span className='skeleton block h-3 w-1/3' />
								<span className='skeleton block h-3 w-2/3' />
							</li>
						))}
					</ul>
				) : visible.length === 0 ? (
					<EmptyState icon={<BellOff className='h-5 w-5' aria-hidden='true' />} title={t("notifications.empty")} />
				) : (
					<ul className='divide-y divide-ink-100 dark:divide-ink-700/70'>
						{visible.map((item) => (
							<li
								key={item.id}
								className={cn(
									"flex animate-fade-in flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start",
									!item.read && "bg-brand-50/60 dark:bg-brand-900/20"
								)}>
								<div className='min-w-0 flex-1'>
									<div className='flex flex-wrap items-center gap-2'>
										{!item.read ? (
											<span className='h-2 w-2 shrink-0 rounded-full bg-brand-500' aria-hidden='true' />
										) : null}
										<p className='text-sm font-medium text-ink-900 dark:text-ink-50'>{item.title}</p>
										{item.mode ? <ModeBadge mode={item.mode} /> : null}
									</div>
									{item.body ? <p className='mt-1 text-sm text-ink-600 dark:text-ink-300'>{item.body}</p> : null}
									{item.preview ? (
										<p className='mt-1 truncate text-xs text-ink-500 dark:text-ink-400'>{item.preview}</p>
									) : null}
									<p className='mt-1.5 text-[11px] text-ink-400' title={formatDateTime(item.createdAt)}>
										{formatRelative(item.createdAt)}
										{item.phone ? (
											<span dir='ltr' className='ms-2'>
												{item.phone}
											</span>
										) : null}
									</p>
								</div>

								<div className='flex shrink-0 items-center gap-2'>
									{item.conversationId ? (
										<Link
											href={`/conversations?id=${item.conversationId}`}
											className='btn-secondary'
											onClick={() => {
												if (!item.read) void markRead(item.id)
											}}>
											{t("notifications.open")}
										</Link>
									) : null}
									{!item.read ? (
										<button type='button' className='btn-ghost' onClick={() => void markRead(item.id)}>
											{t("notifications.markRead")}
										</button>
									) : null}
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</AppShell>
	)
}
