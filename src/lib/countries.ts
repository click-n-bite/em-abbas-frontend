import {
	getCountries,
	getCountryCallingCode,
	parsePhoneNumberFromString,
	AsYouType,
	type CountryCode
} from "libphonenumber-js"
import type { Locale } from "./types"

export interface Country {
	code: CountryCode
	callingCode: string
	name: string
	flag: string
}

/** Regional-indicator emoji flag for an ISO alpha-2 code. */
export function flagOf(code: string): string {
	if (!/^[A-Za-z]{2}$/.test(code)) return "\u{1F3F3}"

	return code
		.toUpperCase()
		.split("")
		.map((char) => String.fromCodePoint(127_397 + char.charCodeAt(0)))
		.join("")
}

function displayNames(locale: Locale): Intl.DisplayNames | null {
	try {
		return new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "region" })
	} catch {
		return null
	}
}

const cache = new Map<Locale, Country[]>()

/** All dialable countries, localized and sorted for the current language. */
export function countryList(locale: Locale): Country[] {
	const cached = cache.get(locale)

	if (cached) return cached

	const names = displayNames(locale)

	const collator = new Intl.Collator(locale === "ar" ? "ar" : "en")

	const list: Country[] = getCountries().map((code) => ({
		code,
		callingCode: getCountryCallingCode(code),
		name: names?.of(code) ?? code,
		flag: flagOf(code)
	}))

	list.sort((a, b) => collator.compare(a.name, b.name))
	cache.set(locale, list)

	return list
}

export function countryName(code: string, locale: Locale): string {
	return displayNames(locale)?.of(code.toUpperCase()) ?? code.toUpperCase()
}

export function callingCodeOf(code: string): string {
	try {
		return getCountryCallingCode(code as CountryCode)
	} catch {
		return ""
	}
}

let callingCodeIndex: Map<string, CountryCode> | null = null

/**
 * Best-effort reverse lookup from a calling code (e.g. "966") back to an
 * ISO alpha-2 country. Some calling codes are shared by multiple countries
 * (e.g. +1), so this is only used for cosmetics (flags, disabling an
 * already-blocked entry in the picker) — never for the actual block check,
 * which relies on the calling code itself.
 */
export function countryForCallingCode(callingCode: string): CountryCode | null {
	const digits = callingCode.replace(/[^\d]/g, "")

	if (!digits) return null

	if (!callingCodeIndex) {
		callingCodeIndex = new Map()
		for (const code of getCountries()) {
			const dial = getCountryCallingCode(code)

			if (!callingCodeIndex.has(dial)) callingCodeIndex.set(dial, code)
		}
	}

	return callingCodeIndex.get(digits) ?? null
}

/** Format digits as the user types, scoped to the selected country. */
export function formatAsYouType(value: string, country: CountryCode): string {
	return new AsYouType(country).input(value)
}

export interface ParsedPhone {
	valid: boolean
	e164: string | null
	country: CountryCode | null
	callingCode: string | null
	/** Number without the country prefix, useful to refill a phone field. */
	national: string
}

/** Parse a national or international number; `country` is the fallback region. */
export function parsePhone(value: string, country?: CountryCode): ParsedPhone {
	const trimmed = value.trim()

	if (!trimmed) {
		return { valid: false, e164: null, country: null, callingCode: null, national: "" }
	}

	const parsed = parsePhoneNumberFromString(trimmed, trimmed.startsWith("+") ? undefined : country)

	if (!parsed) {
		return {
			valid: false,
			e164: null,
			country: country ?? null,
			callingCode: null,
			national: trimmed.replace(/^\+/, "")
		}
	}

	return {
		valid: parsed.isValid(),
		e164: parsed.number,
		country: (parsed.country as CountryCode | undefined) ?? country ?? null,
		callingCode: parsed.countryCallingCode ? String(parsed.countryCallingCode) : null,
		national: parsed.nationalNumber ? String(parsed.nationalNumber) : ""
	}
}

/**
 * Decide whether a number may enter the queue.
 * A number is rejected when its country (or bare calling code) is blacklisted.
 */
export function evaluateNumber(
	value: string,
	blockedCodes: string[],
	blockedCallingCodes: string[],
	fallbackCountry?: CountryCode
): { status: "allowed" | "blocked" | "invalid"; country: CountryCode | null } {
	const parsed = parsePhone(value, fallbackCountry)

	if (!parsed.e164) return { status: "invalid", country: null }

	const upper = blockedCodes.map((code) => code.toUpperCase())

	if (parsed.country && upper.includes(parsed.country)) {
		return { status: "blocked", country: parsed.country }
	}

	if (parsed.callingCode && blockedCallingCodes.includes(parsed.callingCode)) {
		return { status: "blocked", country: parsed.country }
	}

	if (!parsed.valid) return { status: "invalid", country: parsed.country }

	return { status: "allowed", country: parsed.country }
}

export type { CountryCode }
