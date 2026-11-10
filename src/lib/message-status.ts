import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { Message } from "@/lib/features/conversations/types";

export function statusIcon(status: Message["status"]): LucideIcon {
  if (status === "pending") return Clock;

  if (status === "failed") return AlertCircle;

  if (status === "delivered" || status === "read") return CheckCheck;

  return Check;
}

export function statusTint(status: Message["status"]): string | undefined {
  if (status === "read") return "text-sky-300";

  return undefined;
}
