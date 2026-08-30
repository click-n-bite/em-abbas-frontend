/** Matches `NotifyWhatsappNumberResponse` from the real EMA backend
 *  (`/api/admin/notify-whatsapp-numbers`). Phone numbers are stored as
 *  E.164 digits with no leading `+` (e.g. "96171123456"). */
export interface NotifyPhone {
	id: number
	name: string
	/** Digits only, no leading "+". Prefix with "+" for display. */
	phoneNumber: string
	notificationsEnabled: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateNotifyPhonePayload {
	name: string
	/** May be sent with or without a leading "+"; the API normalizes it. */
	phoneNumber: string
	notificationsEnabled?: boolean
}

export interface UpdateNotifyPhonePayload {
	name?: string
	phoneNumber?: string
	notificationsEnabled?: boolean
}
