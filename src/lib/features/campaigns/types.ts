export type CampaignCategory = "marketing" | "utility" | "authentication"

export type ScheduleMode = "now" | "later"

export interface CampaignContact {
	id: string
	name: string
	phone: string
	tags: string[]
}

export interface OptionalPart {
	enabled: boolean
	text: string
}

export interface CampaignDraft {
	name: string
	category: CampaignCategory
	language: string
	header: OptionalPart
	body: string
	footer: OptionalPart
	buttons: { enabled: boolean; items: string[] }
	scheduleMode: ScheduleMode
	scheduleDate: string
	scheduleTime: string
}
