"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/providers/theme-provider"
import { useI18n } from "@/providers/i18n-provider"

export function ThemeToggle() {
	const { theme, setTheme } = useTheme()

	const { t } = useI18n()

	const next = theme === "dark" ? "light" : "dark"

	return (
		<button
			type='button'
			onClick={() => setTheme(next)}
			title={`${t("common.theme")}: ${t(`settings.${next}`)}`}
			aria-label={`${t("common.theme")}: ${t(`settings.${next}`)}`}
			className='rounded-xl border border-ink-200 bg-white p-2 text-ink-600 transition hover:bg-ink-100 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'>
			{theme === "dark" ? (
				<Sun className='h-4 w-4' aria-hidden='true' />
			) : (
				<Moon className='h-4 w-4' aria-hidden='true' />
			)}
		</button>
	)
}
