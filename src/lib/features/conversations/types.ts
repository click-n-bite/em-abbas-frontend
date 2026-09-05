export type Mode = "bot" | "waiting" | "agent"

export type ConversationFilter = "all" | "waiting" | "bot" | "mine" | "hidden" | "agent"

export interface Conversation {
	id: string
	phone: string
	customerName: string | null
	mode: Mode
	assigneeId: string | null
	preview: string | null
	lastMessageAt: string | null
	createdAt?: string | null
	updatedAt?: string | null
	assignee?: { id: string; name: string; email: string } | null
	handoffRequested?: boolean
	lastMessageId?: string | null
	lastMessageDirection?: "inbound" | "outbound" | null
	lastMessageSource?: "customer" | "bot" | "agent" | null
	unreadCount?: number
	lastReadAt?: string | null
	blocked?: boolean
	whatsappStatus?: "blocked" | "failed" | "pending" | "unblocked" | null
	hidden?: boolean
}

export type MessageType =
	| "text"
	| "image"
	| "video"
	| "audio"
	| "document"
	| "sticker"
	| "buttons"
	| "list"
	| "template"
	| "otp"
	| "location"
	| "contacts"
	| "flow"
	| "interactive"
	| "button"
	| "reaction"
	| string

export interface ListRow {
	id: string
	title: string
	description?: string
}

export interface ListSection {
	title?: string
	rows: ListRow[]
}

export interface ButtonItem {
	id: string
	title: string
}

export interface MessagePayload {
	buttons?: ButtonItem[]
	buttonText?: string
	sections?: ListSection[]
	templateName?: string
	language?: string
	bodyParams?: string[]
	headerText?: string | null
	buttonUrlParam?: string | null
	code?: string
	latitude?: number
	longitude?: number
	locationName?: string
	address?: string
	contactName?: string
	phone?: string
	flowId?: string
	flowCta?: string
	screenId?: string
	flowToken?: string
	draftMode?: boolean
	type?: "button_reply" | "list_reply"
	button_reply?: { id: string; title: string }
	list_reply?: { id: string; title: string; description?: string }
	text?: string
	payload?: string
}

export interface Message {
	id: string
	conversationId: string
	direction: "inbound" | "outbound"
	source: "customer" | "bot" | "agent"
	type: string
	text: string | null
	mediaId: string | null
	mediaUrl: string | null
	mimeType: string | null
	filename: string | null
	payload?: MessagePayload | null
	status: "pending" | "sent" | "delivered" | "read" | "failed"
	wamid: string | null
	clientMessageId: string | null
	createdAt: string
	optimistic?: boolean
	agentId?: string | null
	agentName?: string | null
}
