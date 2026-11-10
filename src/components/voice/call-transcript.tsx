"use client";

import {
  AlertCircle,
  AlertTriangle,
  Bot,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, textDirOf } from "@/lib/utils";
import { humanizeCode, tOr } from "@/lib/voice-format";
import type {
  VoiceTranscript,
  VoiceTranscriptItem,
} from "@/lib/features/voice/types";

interface Props {
  transcript: VoiceTranscript | null;
  loading: boolean;
  failure: string | null;
  live: boolean;
  onRetry: () => void;
}

function TurnMeta({ item }: { item: VoiceTranscriptItem }) {
  const { t } = useI18n();

  const notes: Array<{ key: string; text: string; warn: boolean }> = [];

  if (item.speaker === "ai") {
    if (item.interrupted) {
      notes.push({
        key: "interrupted",
        text:
          item.playedAudioOffsetMs != null
            ? t("calls.transcript.interruptedAt", {
                s: (item.playedAudioOffsetMs / 1000).toFixed(1),
              })
            : t("calls.transcript.interrupted"),
        warn: true,
      });
    }

    if (item.playbackLimited) {
      notes.push({
        key: "limited",
        text: t("calls.transcript.playbackLimited"),
        warn: true,
      });
    }
  }

  if (item.deliveryState && item.deliveryState !== "recognized") {
    notes.push({
      key: "delivery",
      text: tOr(
        t,
        `calls.transcript.delivery.${item.deliveryState}`,
        humanizeCode(item.deliveryState),
      ),
      warn: item.deliveryState === "generated_playback_unconfirmed",
    });
  }

  if (notes.length === 0) return null;

  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {notes.map((note) => (
        <span
          key={note.key}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            note.warn
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100"
              : "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200",
          )}
        >
          {note.text}
        </span>
      ))}
    </span>
  );
}

function Turn({ item }: { item: VoiceTranscriptItem }) {
  const { t, formatTime } = useI18n();

  const ai = item.speaker === "ai";

  const Icon = ai ? Bot : UserRound;

  return (
    <li
      className={cn(
        "flex animate-fade-in",
        ai ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[75%]",
          ai
            ? "bubble-out bg-brand-600 text-white"
            : "bubble-in border border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100",
        )}
      >
        <span
          className={cn(
            "mb-1 flex items-center gap-1 text-[11px] font-semibold",
            ai ? "text-white/90" : "text-ink-400",
          )}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {t(ai ? "calls.transcript.ai" : "calls.transcript.caller")}
        </span>
        <p
          dir={textDirOf(item.text)}
          className="whitespace-pre-wrap break-words"
        >
          {item.text}
        </p>
        <TurnMeta item={item} />
        <span
          dir="ltr"
          className={cn(
            "mt-1 block text-end text-[10px]",
            ai ? "text-white/70" : "text-ink-400",
          )}
        >
          {formatTime(item.occurredAt)}
        </span>
      </div>
    </li>
  );
}

export function CallTranscript({
  transcript,
  loading,
  failure,
  live,
  onRetry,
}: Props) {
  const { t, formatDateTime } = useI18n();

  if (loading && !transcript) {
    return (
      <div className="space-y-3 p-5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              "skeleton block h-12",
              index % 2 === 0 ? "me-auto w-2/3" : "ms-auto w-1/2",
            )}
          />
        ))}
      </div>
    );
  }

  if (failure && !transcript) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-5 w-5" aria-hidden="true" />}
        title={t(failure)}
        action={
          <button type="button" className="btn-secondary" onClick={onRetry}>
            {t("common.retry")}
          </button>
        }
      />
    );
  }

  if (!transcript) return null;

  const incomplete =
    transcript.availability !== "available" || transcript.reasons.length > 0;

  return (
    <div>
      {incomplete ? (
        <div
          role="status"
          className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-semibold">
              {t("calls.transcript.incomplete")}
              {transcript.availability !== "available"
                ? ` — ${tOr(
                    t,
                    `calls.transcript.availability.${transcript.availability}`,
                    humanizeCode(transcript.availability),
                  )}`
                : ""}
            </p>
            {transcript.reasons.length > 0 ? (
              <ul className="mt-1 list-disc ps-4">
                {transcript.reasons.map((reason) => (
                  <li key={reason}>
                    {tOr(
                      t,
                      `calls.transcript.reason.${reason}`,
                      humanizeCode(reason),
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="border-b border-ink-100 px-5 py-2 text-[11px] text-ink-400 dark:border-ink-700/70">
        {t("calls.transcript.aiNote")}
        {transcript.lastUpdatedAt
          ? ` · ${t("calls.transcript.updatedAt", {
              time: formatDateTime(transcript.lastUpdatedAt),
            })}`
          : ""}
        {live && !transcript.historyEnded
          ? ` · ${t("calls.transcript.liveHint")}`
          : ""}
      </p>

      {transcript.items.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
          title={t("calls.transcript.empty")}
        />
      ) : (
        <ul className="space-y-3 p-4 sm:p-5">
          {transcript.items.map((item) => (
            <Turn key={item.id} item={item} />
          ))}
        </ul>
      )}

      {transcript.hasMore ? (
        <p className="border-t border-ink-100 px-5 py-2 text-center text-[11px] text-ink-400 dark:border-ink-700/70">
          {t("calls.transcript.truncated")}
        </p>
      ) : null}
    </div>
  );
}
