export type Mode = "bot" | "waiting" | "agent"

export type ConversationFilter = "all" | "waiting" | "bot" | "mine"

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
}

export type MessageType =
	| "text"
	| "image"
	| "video"
	| "audio"
	| "document"
	| "sticker"
	| "location"
	| "contacts"
	| "reaction"

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
	status: "pending" | "sent" | "delivered" | "read" | "failed"
	wamid: string | null
	clientMessageId: string | null
	createdAt: string
	optimistic?: boolean
	agentId?: string | null
	agentName?: string | null
}