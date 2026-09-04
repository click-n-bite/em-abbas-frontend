export type WhatsappBlockStatus = "blocked" | "unblocked" | "failed" | "pending"

export interface BlockedWhatsappNumber {
	id: string
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
	phone: string
	reason?: string | null
}

export type BlockedNumbersStatusFilter = "blocked" | "unblocked" | "all"
