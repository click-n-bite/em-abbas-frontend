"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, MessageCircle, X } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useNotifications } from "@/providers/notifications-provider"
import { Avatar } from "@/components/ui/avatar"
import { RoleBadge } from "@/components/ui/badges"
import { visibleNavItems } from "./nav-items"
import { cn } from "@/lib/utils"

interface Props {
	open: boolean
	onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
	const pathname = usePathname()

	const { t } = useI18n()

	const { agent, role, signOut } = useAuth()

	const { unread } = useNotifications()

	const items = visibleNavItems(role)

	return (
		<>
			{open ? (
				<button
					type='button'
					aria-label={t("common.close")}
					onClick={onClose}
					className='fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden'
				/>
			) : null}

			<aside
				className={cn(
					"fixed inset-y-0 z-40 flex w-64 flex-col border-e border-ink-200 bg-white transition-transform dark:border-ink-700 dark:bg-ink-800 lg:static lg:translate-x-0 lg:rtl:translate-x-0",
					open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
				)}>
				<div className='flex items-center justify-between gap-2 px-4 py-5'>
					<Link href='/overview' className='flex items-center gap-2.5' onClick={onClose}>
						<span className='flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white'>
							<MessageCircle className='h-5 w-5' aria-hidden='true' />
						</span>
						<span className='leading-tight'>
							<span className='block text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("common.appName")}</span>
							<span className='block text-[11px] text-ink-500 dark:text-ink-400'>{t("common.appTagline")}</span>
						</span>
					</Link>
					<button
						type='button'
						onClick={onClose}
						aria-label={t("common.close")}
						className='rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700 lg:hidden'>
						<X className='h-4 w-4' aria-hidden='true' />
					</button>
				</div>

				<nav className='flex-1 space-y-1 overflow-y-auto px-3 pb-4'>
					{items.map((item) => {
						const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

						const Icon = item.icon

						const badge = item.href === "/notifications" && unread > 0 ? unread : null

						return (
							<Link
								key={item.href}
								href={item.href}
								onClick={onClose}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
									active
										? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
										: "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700"
								)}>
								<Icon className='h-4 w-4 shrink-0' aria-hidden='true' />
								<span className='flex-1 truncate'>{t(item.labelKey)}</span>
								{badge ? (
									<span className='badge bg-rose-500 tabular-nums text-white'>{badge > 99 ? "99+" : badge}</span>
								) : null}
							</Link>
						)
					})}
				</nav>

				<div className='border-t border-ink-200 p-3 dark:border-ink-700'>
					<div className='flex items-center gap-3 rounded-xl px-2 py-2'>
						<Avatar name={agent?.name} seed={agent?.email} size='sm' />
						<div className='min-w-0 flex-1'>
							<p className='truncate text-sm font-medium text-ink-800 dark:text-ink-100'>
								{agent?.name ?? t("common.unknown")}
							</p>
							<p className='truncate text-xs text-ink-500 dark:text-ink-400'>{agent?.email}</p>
						</div>
					</div>
					<div className='mt-2 flex items-center justify-between gap-2 px-2'>
						<RoleBadge role={role} />
						<button
							type='button'
							onClick={signOut}
							className='btn-ghost px-2 py-1.5 text-xs'
							title={t("common.signOut")}>
							<LogOut className='h-4 w-4' aria-hidden='true' />
							{t("common.signOut")}
						</button>
					</div>
				</div>
			</aside>
		</>
	)
}
