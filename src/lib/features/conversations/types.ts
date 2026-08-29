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
}

export interface Message {
	id: string
	conversationId: string
	direction: "inbound" | "outbound"
	source: "customer" | "bot" | "agent"
	type: string
	text: string | null
	status: "pending" | "sent" | "delivered" | "read" | "failed"
	wamid: string | null
	clientMessageId: string | null
	createdAt: string
	/** Set locally for messages that are still being delivered to the API. */
	optimistic?: boolean
	/** Agent that sent an outbound message, when the API provides it. */
	agentId?: string | null
	agentName?: string | null
}
