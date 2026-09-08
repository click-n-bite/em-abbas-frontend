export type ActivityActorType = "user" | "bot" | "system"

export type ActivityEventType =
	| "ai.started"
	| "handoff.requested"
	| "agent.took_over"
	| "handed_to_ai"
	| "number.blocked"
	| "number.unblocked"
	| "conversation.hidden"
	| "conversation.unhidden"
	| "conversation.cleared"
	| (string & {})

export interface ConversationActivityEvent {
	id: number
	conversationId: string
	eventType: ActivityEventType
	occurredAt: string
	actorType: ActivityActorType
	actorUserId: number | null
	actorName: string | null
	summary: string
	payload: Record<string, unknown>
}

export interface ConversationActivityResponse {
	conversationId: string
	phone: string
	events: ConversationActivityEvent[]
}
