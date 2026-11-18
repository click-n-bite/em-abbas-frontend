/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ContactErrorCode, ContactEvent } from "./types"

export function formatContactPhone(phone: string | null | undefined): string {
	const digits = (phone ?? "").replace(/\D/g, "")

	return digits ? `+${digits}` : ""
}

export function isValidContactPhone(input: string): boolean {
	if (/[^\d+\s\-()]/.test(input)) return false

	const digits = input.replace(/\D/g, "")

	return digits.length >= 8 && digits.length <= 15
}

function bodyData(error: unknown): Record<string, unknown> | null {
	const e = error as Record<string, any> | null

	const data = e?.data ?? e?.body?.data ?? e?.payload?.data ?? e?.details ?? null

	return data && typeof data === "object" ? data : null
}

export function errorCodeOf(error: unknown): ContactErrorCode | null {
	const code = bodyData(error)?.code

	return typeof code === "string" ? (code as ContactErrorCode) : null
}

export function errorDataOf(error: unknown): Record<string, unknown> {
	return bodyData(error) ?? {}
}

const ERROR_KEYS: Record<ContactErrorCode, string> = {
	NAME_REQUIRED: "contacts.errors.nameRequired",
	INVALID_PHONE: "contacts.errors.invalidPhone",
	TOO_MANY_PHONES: "contacts.errors.tooManyPhones",
	ADMIN_ONLY: "contacts.errors.adminOnly",
	CONTACT_NOT_FOUND: "contacts.errors.notFound",
	CONVERSATION_NOT_FOUND: "contacts.errors.conversationNotFound",
	LINK_NOT_FOUND: "contacts.errors.linkNotFound",
	CUSTOMER_ALREADY_LINKED: "contacts.errors.alreadyLinked"
}

export function contactErrorKey(error: unknown): string | null {
	const code = errorCodeOf(error)

	return code ? (ERROR_KEYS[code] ?? null) : null
}

type Translate = (key: string, values?: Record<string, string | number>) => string

export function toList<T>(value: unknown): T[] {
	if (Array.isArray(value)) return value as T[]

	if (value && typeof value === "object") {
		for (const key of ["suggestions", "items", "data", "content"]) {
			const candidate = (value as Record<string, unknown>)[key]

			if (Array.isArray(candidate)) return candidate as T[]
		}
	}

	return []
}

export function eventText(event: ContactEvent, t: Translate): string {
	const payload = (event.payload ?? {}) as Record<string, any>

	switch (event.eventType) {
		case "created":
			return t("contacts.events.created")

		case "updated": {
			const parts: string[] = []

			if (payload.displayName)
				parts.push(
					t("contacts.events.renamed", {
						from: String(payload.displayName.from ?? ""),
						to: String(payload.displayName.to ?? "")
					})
				)

			if (payload.notes) parts.push(t("contacts.events.notesChanged"))

			if (payload.phoneLabels) parts.push(t("contacts.events.labelsChanged"))

			return parts.length > 0 ? parts.join(" · ") : t("contacts.events.updated")
		}

		case "trusted_changed":
			return t(payload.to ? "contacts.events.trustedOn" : "contacts.events.trustedOff")

		case "phone_added":
			return t("contacts.events.phoneAdded", {
				phone: formatContactPhone(String(payload.phone ?? ""))
			})

		case "phone_removed":
			return t("contacts.events.phoneRemoved", {
				phone: formatContactPhone(String(payload.phone ?? ""))
			})

		case "customer_linked":
			return t("contacts.events.linked", {
				channel: String(payload.channel ?? "")
			})

		case "customer_unlinked":
			return t("contacts.events.unlinked")

		case "deleted":
			return t("contacts.events.deleted")

		default:
			return String(event.eventType)
	}
}
