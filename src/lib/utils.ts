export function cn(...values: Array<string | false | null | undefined>): string {
	return values.filter(Boolean).join(" ")
}

export function initials(value: string | null | undefined): string {
	if (!value) return "#"

	const parts = value.trim().split(/\s+/).slice(0, 2)

	return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "#"
}

export function uuid(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()

	return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Stable HSL colour from a string, used for conversation avatars. */
export function colorFromString(value: string): string {
	let hash = 0

	for (let i = 0; i < value.length; i += 1) {
		hash = value.charCodeAt(i) + ((hash << 5) - hash)
	}

	return `hsl(${Math.abs(hash) % 360} 62% 46%)`
}

export function dayKey(iso: string): string {
	return new Date(iso).toISOString().slice(0, 10)
}

export function isToday(iso: string): boolean {
	return dayKey(iso) === new Date().toISOString().slice(0, 10)
}

export function isYesterday(iso: string): boolean {
	const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

	return dayKey(iso) === yesterday
}

const ARABIC_CHAR_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

/**
 * Direction for free-form text (customer names, message bodies, notification
 * titles, reasons, …) so Arabic content is right-aligned and reads
 * right-to-left even inside an otherwise left-to-right (English) page, and
 * vice versa. Pass this to a `dir` prop, not the whole-page `dir` from
 * useI18n() — that one is for the UI chrome, this one is for the content.
 */
export function textDirOf(text: string | null | undefined): "rtl" | "auto" {
	return text && ARABIC_CHAR_PATTERN.test(text) ? "rtl" : "auto"
}
