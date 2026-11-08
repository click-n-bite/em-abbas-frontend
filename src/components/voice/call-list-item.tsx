"use client";

import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";
import { Avatar } from "@/components/ui/avatar";
import { textDirOf } from "@/lib/utils";
import type { VoiceCall } from "@/lib/features/voice/types";
import { CallDirection, CallDuration, CallStatusBadge } from "./call-badges";

/** Compact card for one call. Links to the call details page. */
export function CallListItem({ call }: { call: VoiceCall }) {
  const { t, formatDateTime } = useI18n();

  const name = call.customerName?.trim() || call.phone;

  return (
    <li className="rounded-xl border border-ink-200 bg-white p-3 transition hover:border-brand-300 dark:border-ink-700 dark:bg-ink-800 dark:hover:border-brand-700">
      <Link
        href={`/calls/${encodeURIComponent(call.id)}`}
        className="flex items-start gap-3"
      >
        <Avatar name={call.customerName} seed={call.phone} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span
              dir={call.customerName?.trim() ? textDirOf(name) : "ltr"}
              className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50"
            >
              {name}
            </span>
            <CallStatusBadge status={call.status} />
          </span>
          {call.customerName?.trim() ? (
            <span
              dir="ltr"
              className="block text-xs text-ink-500 dark:text-ink-400"
            >
              {call.phone}
            </span>
          ) : null}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
            <CallDirection direction={call.direction} />
            <span>{formatDateTime(call.startedAt)}</span>
            <span>
              {t("calls.col.duration")}: <CallDuration call={call} />
            </span>
          </span>
          {call.conversationId ? (
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-300">
              <MessageSquare className="h-3 w-3" aria-hidden="true" />
              {t("calls.linkedConversation")}
            </span>
          ) : null}
        </span>
        <ChevronRight
          className="mt-2 h-4 w-4 shrink-0 text-ink-300 rtl:rotate-180"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
