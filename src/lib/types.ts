export type Locale = "en" | "ar"

export interface RealtimeEvent {
	event:
		| "message.created"
		| "message.status"
		| "conversation.upserted"
		| "conversation.assigned"
		| "conversation.read"
		| "handoff.requested"
	[key: string]: unknown
}
export type { Role, SessionAgent, LoginResponse, AccessTokenClaims } from "./features/auth/types"

export type { Conversation, ConversationFilter, Message, Mode } from "./features/conversations/types"

export type { AppNotification } from "./features/notifications/types"

export type { PortalUser, UserPayload } from "./features/users/types"

export type { BlockCountryPayload, BlockedCountry } from "./features/blacklist/types"

export type { CreateNotifyPhonePayload, NotifyPhone, UpdateNotifyPhonePayload } from "./features/notify-phones/types"
