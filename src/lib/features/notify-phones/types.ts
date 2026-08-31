/**
 * Notify WhatsApp numbers — real EMA backend (/api/admin/notify-whatsapp-numbers).
 * CRUD only: saving a number does not send WhatsApp by itself, it just
 * registers a recipient who may later receive alerts. SUPER_ADMIN / ADMIN only.
 */
export interface NotifyPhone {
	id: number
	name: string
	/** E.164 digits, no leading "+" (e.g. "96171123456"). */
	phoneNumber: string
	notificationsEnabled: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateNotifyPhonePayload {
	name: string
	/** Accepts "+96171123456" or "96171123456" — the backend normalizes it. */
	phoneNumber: string
	notificationsEnabled?: boolean
}

export interface UpdateNotifyPhonePayload {
	name?: string
	phoneNumber?: string
	notificationsEnabled?: boolean
}
