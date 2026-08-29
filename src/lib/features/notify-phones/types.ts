export interface NotifyPhone {
	id: string
	/** E.164 number, e.g. "+201234567890". */
	phone: string
	/** ISO-3166-1 alpha-2 of the number, used to render the flag. */
	country: string | null
	label: string | null
	createdAt: string
	createdBy: string | null
	local?: boolean
}

export interface NotifyPhonePayload {
	phone: string
	country: string | null
	label: string | null
	createdBy: string | null
}
