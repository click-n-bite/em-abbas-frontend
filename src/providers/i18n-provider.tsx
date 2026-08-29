"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { DEFAULT_LOCALE, STORAGE_KEYS } from "@/lib/config"
import { dictionaries, dirOf, interpolate, lookup } from "@/i18n"
import type { Locale } from "@/lib/types"

type Translate = (key: string, vars?: Record<string, string | number>) => string

interface I18nContextValue {
	locale: Locale
	dir: "ltr" | "rtl"
	setLocale: (locale: Locale) => void
	toggleLocale: () => void
	t: Translate
	formatDateTime: (value: string | number | Date) => string
	formatTime: (value: string | number | Date) => string
	formatRelative: (value: string | number | Date) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

	useEffect(() => {
		const stored = window.localStorage.getItem(STORAGE_KEYS.locale)

		if (stored === "ar" || stored === "en") setLocaleState(stored)
	}, [])

	useEffect(() => {
		const dir = dirOf(locale)

		document.documentElement.lang = locale
		document.documentElement.dir = dir
	}, [locale])

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next)
		window.localStorage.setItem(STORAGE_KEYS.locale, next)
	}, [])

	const value = useMemo<I18nContextValue>(() => {
		const dict = dictionaries[locale]

		const tag = locale === "ar" ? "ar" : "en-GB"

		const t: Translate = (key, vars) => interpolate(lookup(dict, key), vars)

		const formatDateTime = (input: string | number | Date) =>
			new Intl.DateTimeFormat(tag, {
				dateStyle: "medium",
				timeStyle: "short",
				numberingSystem: "latn"
			}).format(new Date(input))

		const formatTime = (input: string | number | Date) =>
			new Intl.DateTimeFormat(tag, { timeStyle: "short", numberingSystem: "latn" }).format(new Date(input))

		const formatRelative = (input: string | number | Date) => {
			const diff = Date.now() - new Date(input).getTime()

			const minutes = Math.round(diff / 60000)

			if (minutes < 1) return t("common.justNow")

			if (minutes < 60) return t("common.minutesAgo", { n: minutes })

			const hours = Math.round(minutes / 60)

			if (hours < 24) return t("common.hoursAgo", { n: hours })

			return t("common.daysAgo", { n: Math.round(hours / 24) })
		}

		return {
			locale,
			dir: dirOf(locale),
			setLocale,
			toggleLocale: () => setLocale(locale === "en" ? "ar" : "en"),
			t,
			formatDateTime,
			formatTime,
			formatRelative
		}
	}, [locale, setLocale])

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
	const ctx = useContext(I18nContext)

	if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>")

	return ctx
}
