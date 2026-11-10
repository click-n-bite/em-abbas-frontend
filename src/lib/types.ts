export type Locale = "en" | "ar";

export interface RealtimeEvent {
  event:
    | "message.created"
    | "message.status"
    | "conversation.upserted"
    | "conversation.window"
    | "conversation.assigned"
    | "conversation.read"
    | "conversation.blocked"
    | "conversation.hidden"
    | "conversation.unhidden"
    | "handoff.requested"
    | "conversation.renamed";
  [key: string]: unknown;
}

export type {
  Role,
  SessionAgent,
  LoginResponse,
  AccessTokenClaims,
} from "./features/auth/types";

export type {
  ButtonItem,
  Conversation,
  ConversationFilter,
  ListRow,
  ListSection,
  Message,
  MessagePayload,
  Mode,
} from "./features/conversations/types";

export type { AppNotification } from "./features/notifications/types";

export type {
  PortalUser,
  UserPayload,
  UserSortField,
  UsersListParams,
} from "./features/users/types";

export type { SortDirection, SortState } from "./sorting";

export type {
  BlockCountryPayload,
  BlockedCountry,
} from "./features/blacklist/types";

export type {
  BlockedNumbersStatusFilter,
  BlockedWhatsappNumber,
  BlockNumberPayload,
  WhatsappBlockStatus,
} from "./features/blocked-numbers/types";

export type {
  CreateNotifyPhonePayload,
  NotifyPhone,
  UpdateNotifyPhonePayload,
} from "./features/notify-phones/types";

export type {
  CreateLeadPayload,
  Lead,
  LeadCreator,
  LeadService,
  LeadSource,
  LeadStatus,
  LeadSortField,
  LeadsListParams,
  LeadsPage,
  UpdateLeadPayload,
} from "./features/leads/types";

export type {
  ActivityListParams,
  ActivitySortField,
  ActivityActorType,
  ActivityEventType,
  ConversationActivityEvent,
  ConversationActivityResponse,
} from "./features/activity/types";
