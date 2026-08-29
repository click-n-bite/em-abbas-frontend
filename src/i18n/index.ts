import en, { type Dictionary } from "./en"
import ar from "./ar"
import type { Locale } from "@/lib/types"

export const dictionaries: Record<Locale, Dictionary> = { en, ar }

export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] = [
	{ code: "en", label: "English", dir: "ltr" },
	{ code: "ar", label: "العربية", dir: "rtl" }
]

export function dirOf(locale: Locale): "ltr" | "rtl" {
	return locale === "ar" ? "rtl" : "ltr"
}

/** Resolve a dotted key such as `users.roles.admin` against a dictionary. */
export function lookup(dict: Dictionary, key: string): string {
	const value = key.split(".").reduce<unknown>((acc, part) => {
		if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
			return (acc as Record<string, unknown>)[part]
		}

		return undefined
	}, dict)

	return typeof value === "string" ? value : key
}

export function interpolate(template: string, vars?: Record<string, string | number>): string {
	if (!vars) return template

	return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match))
}

export type { Dictionary }
