export interface BlockedCountry {
	id: string
	callingCode: string
	nameAr: string
	nameEn: string
	createdAt?: string
	createdBy?: string | null
}

export interface BlockCountryPayload {
	callingCode: string
	nameAr: string
	nameEn: string
}
