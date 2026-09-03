export type WhatsappBlockStatus = "blocked" | "unblocked" | "failed" | "pending"

/** A row from /api/admin/blocked-whatsapp-numbers. Unblocking keeps the row (history). */
export interface BlockedWhatsappNumber {
	id: string
	/** Digits only — "+" and spaces are stripped server-side. */
	phone: string
	reason: string | null
	createdBy: number | string | null
	localStatus: "blocked" | "unblocked"
	whatsappStatus: WhatsappBlockStatus
	whatsappError: string | null
	waId: string | null
	createdAt: string
	updatedAt: string
}

export interface BlockNumberPayload {
	/** Full customer WhatsApp number, at least 8 digits after stripping non-digits. */
	phone: string
	/** Optional audit text — never sent to Meta or the customer. */
	reason?: string | null
}

export type BlockedNumbersStatusFilter = "blocked" | "unblocked" | "all"
