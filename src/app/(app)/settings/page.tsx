"use client"

import { useEffect, useState } from "react"
import { Bell, Check, LogOut, Moon, PlayCircle, Sun, Volume2, VolumeX } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { useI18n } from "@/providers/i18n-provider"
import { useTheme } from "@/providers/theme-provider"
import { AppShell } from "@/components/layout/app-shell"
import { Avatar } from "@/components/ui/avatar"
import { RoleBadge } from "@/components/ui/badges"
import { LanguageSwitcher } from "@/components/language-switcher"
import { cn } from "@/lib/utils"
import { isSoundEnabled, playMessageSound, setSoundEnabled } from "@/lib/sound"

export default function SettingsPage() {
	const { t } = useI18n()

	const { agent, role, signOut } = useAuth()

	const { theme, setTheme } = useTheme()

	const [soundOn, setSoundOn] = useState(true)

	const [pinging, setPinging] = useState(false)

	useEffect(() => {
		setSoundOn(isSoundEnabled())
	}, [])

	const toggleSound = () => {
		const next = !soundOn

		setSoundOn(next)
		setSoundEnabled(next)

		if (next) testSound()
	}

	const testSound = () => {
		playMessageSound()
		setPinging(true)
		window.setTimeout(() => setPinging(false), 700)
	}

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

				<section className='card overflow-hidden p-5'>
					<div className='flex items-center gap-3'>
						<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm'>
							<Bell className='h-4 w-4' aria-hidden='true' />
						</span>
						<div className='min-w-0'>
							<h2 className='text-sm font-semibold text-ink-900 dark:text-ink-50'>{t("settings.notifications")}</h2>
							<p className='text-xs text-ink-500 dark:text-ink-400'>{t("settings.messageSoundHelp")}</p>
						</div>
					</div>

					<div
						className={cn(
							"mt-4 flex items-center gap-3 rounded-2xl border p-3.5 transition-colors",
							soundOn
								? "dark:bg-brand-950/40 border-brand-200 bg-brand-50/60 dark:border-brand-900"
								: "border-ink-200 dark:border-ink-700"
						)}>
						<span
							className={cn(
								"flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
								soundOn
									? "bg-white text-brand-600 shadow-sm dark:bg-ink-800"
									: "bg-ink-100 text-ink-400 dark:bg-ink-700"
							)}>
							{soundOn ? (
								<Volume2 className='h-4 w-4' aria-hidden='true' />
							) : (
								<VolumeX className='h-4 w-4' aria-hidden='true' />
							)}
						</span>

						<div className='min-w-0 flex-1'>
							<p className='text-sm font-medium text-ink-800 dark:text-ink-100'>{t("settings.messageSound")}</p>
							<div className='mt-1.5 flex h-3 items-end gap-0.5' aria-hidden='true'>
								{[0, 1, 2, 3, 4].map((bar) => (
									<span
										key={bar}
										className={cn(
											"w-1 rounded-full transition-all duration-300",
											soundOn ? "animate-pulse bg-brand-500" : "h-1 bg-ink-300 dark:bg-ink-600"
										)}
										style={
											soundOn
												? {
														height: `${4 + ((bar * 7) % 12)}px`,
														animationDelay: `${bar * 120}ms`,
														animationDuration: "1100ms"
													}
												: undefined
										}
									/>
								))}
							</div>
						</div>

						<button
							type='button'
							onClick={testSound}
							disabled={!soundOn}
							aria-label={t("settings.testSound")}
							title={t("settings.testSound")}
							className={cn(
								"btn-ghost h-9 w-9 shrink-0 rounded-full p-0 disabled:cursor-not-allowed disabled:opacity-30",
								pinging && "text-brand-600"
							)}>
							<PlayCircle className={cn("h-4 w-4", pinging && "animate-ping-once")} aria-hidden='true' />
						</button>

						<button
							type='button'
							onClick={toggleSound}
							role='switch'
							aria-checked={soundOn}
							aria-label={t("settings.messageSound")}
							className={cn(
								"relative h-6 w-11 shrink-0 rounded-full transition-all duration-300 ease-out",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-800",
								soundOn
									? "bg-gradient-to-r from-brand-500 to-brand-600 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]"
									: "bg-ink-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] dark:bg-ink-600"
							)}>
							<span
								className={cn(
									"absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 transition-all duration-300 ease-out",
									soundOn
										? "translate-x-[1.375rem] text-brand-600 rtl:-translate-x-[1.375rem]"
										: "translate-x-0.5 text-transparent"
								)}>
								<Check className='h-3 w-3 transition-opacity duration-200' aria-hidden='true' />
							</span>
						</button>
					</div>
				</section>
			</div>
		</AppShell>
	)
}
