export type Locale = "en" | "ar"

export interface RealtimeEvent {
	event:
		| "message.created"
		| "message.status"
		| "conversation.upserted"
		| "conversation.assigned"
		| "conversation.read"
		| "conversation.blocked"
		| "handoff.requested"
	[key: string]: unknown
}

export type { Role, SessionAgent, LoginResponse, AccessTokenClaims } from "./features/auth/types"

export type {
	ButtonItem,
	Conversation,
	ConversationFilter,
	ListRow,
	ListSection,
	Message,
	MessagePayload,
	Mode
} from "./features/conversations/types"

export type { AppNotification } from "./features/notifications/types"

export type { PortalUser, UserPayload } from "./features/users/types"

export type { BlockCountryPayload, BlockedCountry } from "./features/blacklist/types"

export type {
	BlockedNumbersStatusFilter,
	BlockedWhatsappNumber,
	BlockNumberPayload,
	WhatsappBlockStatus
} from "./features/blocked-numbers/types"

export type { CreateNotifyPhonePayload, NotifyPhone, UpdateNotifyPhonePayload } from "./features/notify-phones/types"
