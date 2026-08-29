"use client"

import { Menu } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "./notification-bell"

interface Props {
	title: string
	subtitle?: string
	onMenu: () => void
	actions?: React.ReactNode
}

export function Topbar({ title, subtitle, onMenu, actions }: Props) {
	const { t } = useI18n()

	return (
		<header className='sticky top-0 z-20 border-b border-ink-200 bg-white/80 backdrop-blur dark:border-ink-700 dark:bg-ink-800/80'>
			<div className='flex items-center gap-3 px-4 py-3 sm:px-6'>
				<button
					type='button'
					onClick={onMenu}
					aria-label={t("nav.dashboard")}
					className='rounded-xl border border-ink-200 p-2 text-ink-600 hover:bg-ink-100 dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-700 lg:hidden'>
					<Menu className='h-4 w-4' aria-hidden='true' />
				</button>

				<div className='min-w-0 flex-1'>
					<h1 className='truncate text-base font-semibold text-ink-900 dark:text-ink-50 sm:text-lg'>{title}</h1>
					{subtitle ? <p className='truncate text-xs text-ink-500 dark:text-ink-400'>{subtitle}</p> : null}
				</div>

				<div className='flex items-center gap-2'>
					{actions}
					<div className='hidden sm:block'>
						<LanguageSwitcher />
					</div>
					<ThemeToggle />
					<NotificationBell />
				</div>
			</div>
		</header>
	)
}
