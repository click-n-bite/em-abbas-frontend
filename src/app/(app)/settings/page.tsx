"use client"

import { LogOut, Moon, Sun } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useTheme } from "@/providers/theme-provider"
import { AppShell } from "@/components/layout/app-shell"
import { Avatar } from "@/components/ui/avatar"
import { RoleBadge } from "@/components/ui/badges"
import { LanguageSwitcher } from "@/components/language-switcher"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
	const { t } = useI18n()

	const { agent, role, signOut } = useAuth()

	const { theme, setTheme } = useTheme()

	const themes: Array<{ value: "light" | "dark"; label: string; icon: typeof Sun }> = [
		{ value: "light", label: t("settings.light"), icon: Sun },
		{ value: "dark", label: t("settings.dark"), icon: Moon }
	]

	return (
		<AppShell title={t("settings.title")} subtitle={t("settings.subtitle")}>
			<div className='grid gap-6 lg:grid-cols-2'>
				<section className='card p-5'>
					<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("settings.session")}</h2>
					<div className='mt-4 flex items-center gap-3'>
						<Avatar name={agent?.name ?? "?"} seed={agent?.email ?? ""} />
						<div className='min-w-0'>
							<p className='truncate text-sm font-medium text-ink-900 dark:text-ink-50'>
								{agent?.name ?? t("common.unknown")}
							</p>
							<p dir='ltr' className='truncate text-xs text-ink-500 dark:text-ink-400'>
								{agent?.email ?? ""}
							</p>
						</div>
					</div>

					<dl className='mt-4 flex items-center justify-between rounded-xl border border-ink-200 px-3 py-2.5 dark:border-ink-700'>
						<dt className='text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400'>{t("settings.role")}</dt>
						<dd>
							<RoleBadge role={role} />
						</dd>
					</dl>

					<button type='button' onClick={signOut} className='btn-secondary mt-4 w-full justify-center'>
						<LogOut className='h-4 w-4' aria-hidden='true' />
						{t("common.signOut")}
					</button>
				</section>

				<section className='card p-5'>
					<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("settings.appearance")}</h2>

					<div className='mt-4 space-y-4'>
						<div>
							<p className='label'>{t("common.theme")}</p>
							<div className='grid grid-cols-2 gap-2'>
								{themes.map((option) => {
									const Icon = option.icon

									const active = theme === option.value

									return (
										<button
											key={option.value}
											type='button'
											onClick={() => setTheme(option.value)}
											aria-pressed={active}
											className={cn(
												"flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
												active
													? "dark:bg-brand-950 border-brand-500 bg-brand-50 text-brand-700 dark:text-brand-200"
													: "border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-700"
											)}>
											<Icon className='h-4 w-4' aria-hidden='true' />
											{option.label}
										</button>
									)
								})}
							</div>
						</div>

						<div>
							<p className='label'>{t("common.language")}</p>
							<LanguageSwitcher />
							<p className='mt-2 text-xs text-ink-500 dark:text-ink-400'>{t("settings.languageHelp")}</p>
						</div>
					</div>
				</section>
			</div>
		</AppShell>
	)
}
