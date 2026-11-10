import type { SortDirection } from "@/lib/sorting";

export type ActivityActorType = "user" | "bot" | "system";

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
  | "conversation.renamed"
  | (string & {});

export interface ConversationActivityEvent {
  id: number;
  conversationId: string;
  eventType: ActivityEventType;
  occurredAt: string;
  actorType: ActivityActorType;
  actorUserId: number | null;
  actorName: string | null;
  summary: string;
  payload: Record<string, unknown>;
}

export interface ConversationActivityResponse {
  conversationId: string;
  phone: string | null;
  events: ConversationActivityEvent[];
}

export type ActivitySortField =
  | "id"
  | "eventType"
  | "occurredAt"
  | "actorType"
  | "actorUserId"
  | "actorName";

export interface ActivityListParams {
  sort?: ActivitySortField;
  direction?: SortDirection;
}
