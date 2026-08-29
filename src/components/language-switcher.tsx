"use client"

import { Languages } from "lucide-react"
import { useI18n } from "@/providers/i18n-provider"
import type { Locale } from "@/lib/types"

const options: Array<{ value: Locale; label: string }> = [
	{ value: "en", label: "English" },
	{ value: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" }
]

/** Segmented EN / AR toggle. Switching to Arabic flips the document to RTL. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
	const { locale, setLocale, t } = useI18n()

	return (
		<div
			role='group'
			aria-label={t("common.language")}
			className='flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1 dark:border-ink-600 dark:bg-ink-800'>
			{compact ? <Languages className='mx-1 h-4 w-4 text-ink-400' aria-hidden='true' /> : null}
			{options.map((option) => (
				<button
					key={option.value}
					type='button'
					onClick={() => setLocale(option.value)}
					aria-pressed={locale === option.value}
					className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
						locale === option.value
							? "bg-brand-600 text-white"
							: "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700"
					}`}>
					{option.label}
				</button>
			))}
		</div>
	)
}
