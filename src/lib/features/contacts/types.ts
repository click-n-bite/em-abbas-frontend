export type ContactSource = "manual" | "chat" | "import"

export interface ContactPhone {
	id: number
	phone: string
	label: string | null
}

export interface ActorRef {
	id: number | null
	name: string
}

export interface ContactRef {
	id: number
	name: string
	trusted: boolean
}

export interface ContactSummary {
	id: number
	displayName: string
	trusted: boolean
	source: ContactSource
	phones: ContactPhone[]
	linkedCustomerCount: number
	updatedAt: string
}

export interface LinkedChat {
	conversationId: string
	customerId: number
	channel: string
	phone: string | null
	customerName: string | null
	lastMessageAt: string | null
	hidden: boolean
	linkedAt: string
	linkedBy: ActorRef | null
}

export interface ContactWarning {
	code: "PHONE_ON_OTHER_CONTACT" | (string & {})
	contactId: number
	contactName: string
	phone: string
}

export interface Contact {
	id: number
	displayName: string
	notes: string | null
	trusted: boolean
	source: ContactSource
	phones: ContactPhone[]
	linkedCustomerCount: number
	linkedChats: LinkedChat[]
	createdBy: ActorRef | null
	createdAt: string
	updatedAt: string
	warnings: ContactWarning[]
}

export type ContactEventType =
	| "created"
	| "updated"
	| "trusted_changed"
	| "phone_added"
	| "phone_removed"
	| "customer_linked"
	| "customer_unlinked"
	| "deleted"

export interface ContactEvent {
	id: number
	eventType: ContactEventType | (string & {})
	occurredAt: string
	actor: ActorRef | null
	payload: Record<string, unknown> | null
}

export interface ChatSuggestion {
	conversationId: string
	customerId: number
	channel: string
	phone: string | null
	customerName: string | null
	lastMessageAt: string | null
}

export interface ContactSuggestion {
	id: number
	displayName: string
	trusted: boolean
	matchedPhones: string[]
}

export type ContactSortField = "name" | "createdAt" | "updatedAt"

export interface ContactsListParams {
	search?: string
	trusted?: boolean
	linked?: boolean
	sort?: ContactSortField
	direction?: "asc" | "desc"
	page?: number
	size?: number
}

export interface ContactsPage {
	items: ContactSummary[]
	page: number
	size: number
	total: number
	totalPages: number
}

export interface ContactPhoneInput {
	phone: string
	label?: string | null
}

export interface ContactInput {
	displayName?: string
	notes?: string
	phones?: ContactPhoneInput[]
	trusted?: boolean
	trustedReason?: string
}

export interface SaveFromChatInput {
	displayName?: string
	notes?: string
}

export type ContactErrorCode =
	| "NAME_REQUIRED"
	| "INVALID_PHONE"
	| "TOO_MANY_PHONES"
	| "ADMIN_ONLY"
	| "CONTACT_NOT_FOUND"
	| "CONVERSATION_NOT_FOUND"
	| "LINK_NOT_FOUND"
	| "CUSTOMER_ALREADY_LINKED"
