export type Mode = "bot" | "waiting" | "agent"

export type ConversationFilter = "all" | "waiting" | "bot" | "mine" | "hidden"

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
	/** Open-chat only (GET /conversations/{id}, takeover, hand-back, mark-read). Not on inbox list rows. */
	blocked?: boolean
	whatsappStatus?: "blocked" | "failed" | "pending" | "unblocked" | null
	/** True once /conversations/{id}/hide has been called. Cleared by /unhide. */
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

/** Rich-message payload. Shape depends on `Message.type` — see FRONTEND-AGENT-SEND-AND-NOTIFY.md. */
export interface MessagePayload {
	// buttons
	buttons?: ButtonItem[]
	// list
	buttonText?: string
	sections?: ListSection[]
	// template / otp
	templateName?: string
	language?: string
	bodyParams?: string[]
	headerText?: string | null
	buttonUrlParam?: string | null
	code?: string
	// location
	latitude?: number
	longitude?: number
	locationName?: string
	address?: string
	// contacts
	contactName?: string
	phone?: string
	// flow
	flowId?: string
	flowCta?: string
	screenId?: string
	flowToken?: string
	draftMode?: boolean
	// inbound taps (interactive / button)
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
