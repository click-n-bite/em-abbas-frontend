export type LeadStatus = "open" | "closed"

export type LeadSource = "ai" | "agent"

export interface LeadService {
	id: number
	key: string
	name: string
}

export interface LeadCreator {
	id: number
	username: string
	displayName: string
	role: string
}

export interface Lead {
	id: number
	status: LeadStatus
	source: LeadSource
	conversationId: string
	phone: string
	customerName: string | null
	serviceId: number
	serviceKey: string
	serviceName: string
	collectedFields: Record<string, unknown>
	note: string | null
	createdBy: LeadCreator | null
	closedBy: LeadCreator | null
	closeNote: string | null
	closedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface LeadsPage {
	items: Lead[]
	page: number
	size: number
	total: number
	totalPages: number
}

export interface LeadsListParams {
	status?: LeadStatus
	source?: LeadSource
	serviceId?: number
	createdBy?: string | number
	mine?: boolean
	search?: string
	from?: string
	to?: string
	page?: number
	size?: number
}

export interface CreateLeadPayload {
	conversationId: string
	serviceId: number
	note?: string
	collectedFields?: Record<string, unknown>
}

export interface UpdateLeadPayload {
	status?: LeadStatus
	closeNote?: string
	note?: string
}
