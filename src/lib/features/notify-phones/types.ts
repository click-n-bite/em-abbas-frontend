export interface NotifyPhone {
	id: number
	name: string
	phoneNumber: string
	notificationsEnabled: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateNotifyPhonePayload {
	name: string
	phoneNumber: string
	notificationsEnabled?: boolean
}

export interface UpdateNotifyPhonePayload {
	name?: string
	phoneNumber?: string
	notificationsEnabled?: boolean
}
