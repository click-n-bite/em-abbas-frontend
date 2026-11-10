import type { Mode } from "@/lib/features/conversations/types";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  readAt: string | null;
  conversationId: string | null;
  leadId: string | null;
  phone: string | null;
  customerName?: string | null;
  serviceName?: string | null;
  mode: Mode | null;
  preview: string | null;
  createdAt: string;
}
