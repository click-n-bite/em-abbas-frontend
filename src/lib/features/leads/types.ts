import type { SortDirection } from "@/lib/sorting";
import type { ChannelIdentity } from "../../channel-identity";

export type LeadStatus = "open" | "in_progress" | "closed";

export type LeadSource = "ai" | "agent";

export interface LeadService {
  id: number;
  key: string;
  name: string;
}

export interface LeadCreator {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

export interface Lead extends ChannelIdentity {
  id: number;
  status: LeadStatus;
  source: LeadSource;
  conversationId: string;
  phone: string | null;
  customerName: string | null;
  serviceId: number;
  serviceKey: string;
  serviceName: string;
  collectedFields: Record<string, unknown>;
  note: string | null;
  createdBy: LeadCreator | null;
  closedBy: LeadCreator | null;
  startedBy?: LeadCreator | null;
  startedAt?: string | null;
  closeNote: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadsPage {
  items: Lead[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export type LeadSortField =
  | "id"
  | "status"
  | "source"
  | "phone"
  | "customerName"
  | "serviceId"
  | "serviceKey"
  | "serviceName"
  | "createdBy"
  | "closedBy"
  | "createdAt"
  | "updatedAt"
  | "closedAt";

export interface LeadsListParams {
  status?: LeadStatus;
  source?: LeadSource;
  serviceId?: number;
  createdBy?: string | number;
  mine?: boolean;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: LeadSortField;
  direction?: SortDirection;
}

export interface CreateLeadPayload {
  conversationId: string;
  serviceId: number;
  note?: string;
  collectedFields?: Record<string, unknown>;
}

export type LeadExportScope = "filtered" | "active" | "all";

export interface LeadExportParams
  extends Omit<LeadsListParams, "page" | "size"> {
  scope: LeadExportScope;
  language: "en" | "ar";
}

export interface UpdateLeadPayload {
  status?: LeadStatus;
  closeNote?: string;
  note?: string;
  /** Corrected text answers keyed by existing field name. */
  collectedFields?: Record<string, string>;
  /** Renames the customer everywhere (chat display name and the Full name answer). */
  customerName?: string;
}
