"use client";

import {
  AlertCircle,
  Check,
  CircleHelp,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
} from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";
import {
  elapsedSince,
  formatDurationMs,
  isActiveCall,
  tOr,
} from "@/lib/voice-format";
import type { VoiceCall, VoiceCallStatus } from "@/lib/features/voice/types";

const statusStyles: Record<VoiceCallStatus, string> = {
  incoming:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  ringing:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  in_progress:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  completed: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200",
  missed: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  failed: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  unknown:
    "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
};

const statusIcons: Record<VoiceCallStatus, typeof Check> = {
  incoming: PhoneIncoming,
  ringing: PhoneCall,
  in_progress: PhoneCall,
  completed: Check,
  missed: PhoneMissed,
  rejected: PhoneOff,
  failed: AlertCircle,
  unknown: CircleHelp,
};

export function CallStatusBadge({ status }: { status: VoiceCallStatus }) {
  const { t } = useI18n();

  const known = status in statusStyles ? status : "unknown";

  const Icon = statusIcons[known];

  return (
    <span className={cn("badge", statusStyles[known])}>
      {isActiveCall(known) ? (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      ) : (
        <Icon className="h-3 w-3" aria-hidden="true" />
      )}
      {tOr(t, `calls.status.${known}`, String(status))}
    </span>
  );
}

export function CallDirection({
  direction,
  className,
}: {
  direction: string;
  className?: string;
}) {
  const { t } = useI18n();

  const outbound = direction?.toLowerCase() === "outbound";

  const Icon = outbound ? PhoneOutgoing : PhoneIncoming;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {tOr(t, `calls.direction.${direction}`, direction || "—")}
    </span>
  );
}

/**
 * Duration of a call. The backend leaves durations `null` until the end is
 * confirmed, so a live call shows a ticking timer computed from `startedAt`.
 */
export function CallDuration({
  call,
  field = "durationMs",
}: {
  call: Pick<
    VoiceCall,
    "status" | "startedAt" | "durationMs" | "talkDurationMs"
  >;
  field?: "durationMs" | "talkDurationMs";
}) {
  const live = isActiveCall(call.status) && call.durationMs == null;

  const now = useNow(live);

  if (live && field === "durationMs") {
    return (
      <span className="tabular-nums" dir="ltr">
        {formatDurationMs(elapsedSince(call.startedAt, now))}
      </span>
    );
  }

  return (
    <span className="tabular-nums" dir="ltr">
      {formatDurationMs(call[field])}
    </span>
  );
}
