"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  PhoneOff,
  RefreshCw,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { voiceApi } from "@/lib/features/voice/api";
import type { VoiceCall, VoiceTranscript } from "@/lib/features/voice/types";
import { isActiveCall } from "@/lib/voice-format";
import { usePoll } from "@/hooks/use-poll";
import { useVoiceEvents } from "@/hooks/use-voice-events";
import { useI18n } from "@/providers/i18n-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CallDirection,
  CallDuration,
  CallStatusBadge,
} from "@/components/voice/call-badges";
import { CallTranscript } from "@/components/voice/call-transcript";
import { cn, textDirOf } from "@/lib/utils";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-500 dark:text-ink-400">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-ink-900 dark:text-ink-100">
        {children}
      </dd>
    </div>
  );
}

export default function CallDetailsPage() {
  const params = useParams<{ id: string }>();

  const router = useRouter();

  const { t, dir, formatDateTime } = useI18n();

  const callId = safeDecode(String(params?.id ?? ""));

  const [call, setCall] = useState<VoiceCall | null>(null);

  const [callLoading, setCallLoading] = useState(true);

  const [callFailure, setCallFailure] = useState<{
    key: string;
    status: number | null;
  } | null>(null);

  const [transcript, setTranscript] = useState<VoiceTranscript | null>(null);

  const [transcriptLoading, setTranscriptLoading] = useState(true);

  const [transcriptFailure, setTranscriptFailure] = useState<string | null>(
    null,
  );

  const callRequest = useRef(0);

  const transcriptRequest = useRef(0);

  const previousStatus = useRef<string | null>(null);

  const loadCall = useCallback(
    async (silent = false) => {
      if (!callId) return;

      const id = ++callRequest.current;

      if (!silent) setCallLoading(true);

      try {
        const result = await voiceApi.get(callId);

        if (id !== callRequest.current) return;

        setCall(result);
        setCallFailure(null);
      } catch (error) {
        if (id !== callRequest.current) return;

        // A transient error must not wipe a call we already display.
        if (silent) return;

        setCallFailure({
          key: errorKey(error),
          status: error instanceof ApiError ? error.status : null,
        });
      } finally {
        if (id === callRequest.current) setCallLoading(false);
      }
    },
    [callId],
  );

  const loadTranscript = useCallback(
    async (silent = false) => {
      if (!callId) return;

      const id = ++transcriptRequest.current;

      if (!silent) setTranscriptLoading(true);

      try {
        // Always from sequence 0: a late event can change an earlier AI turn.
        const result = await voiceApi.transcript(callId);

        if (id !== transcriptRequest.current) return;

        setTranscript(result);
        setTranscriptFailure(null);
      } catch (error) {
        if (id !== transcriptRequest.current) return;

        if (silent) return;

        setTranscriptFailure(errorKey(error));
      } finally {
        if (id === transcriptRequest.current) setTranscriptLoading(false);
      }
    },
    [callId],
  );

  useEffect(() => {
    setCall(null);
    setTranscript(null);
    previousStatus.current = null;
    void loadCall();
    void loadTranscript();
  }, [loadCall, loadTranscript]);

  // When the call stops being live (seen via REST), load the final transcript
  // even if the WebSocket hint never arrived.
  useEffect(() => {
    const status = call?.status ?? null;

    if (
      previousStatus.current &&
      isActiveCall(previousStatus.current) &&
      status &&
      !isActiveCall(status)
    ) {
      void loadTranscript(true);
    }

    previousStatus.current = status;
  }, [call?.status, loadTranscript]);

  useVoiceEvents({
    topics: callId ? [`/topic/voice/calls/${callId}`] : [],
    enabled: Boolean(callId),
    onRefresh: ({ events, reconnect }) => {
      void loadCall(true);

      if (
        reconnect ||
        events.has("voice.transcript.updated") ||
        events.has("voice.call.ended")
      ) {
        void loadTranscript(true);
      }
    },
  });

  const live = call ? isActiveCall(call.status) : false;

  usePoll(
    () => {
      void loadCall(true);
      void loadTranscript(true);
    },
    30_000,
    live,
  );

  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const backLink = (
    <Link
      href="/calls"
      className="btn-secondary px-3 py-2"
      title={t("calls.backToList")}
    >
      <BackIcon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t("calls.backToList")}</span>
    </Link>
  );

  const refreshButton = (
    <button
      type="button"
      onClick={() => {
        void loadCall(true);
        void loadTranscript(true);
      }}
      className="btn-secondary px-3 py-2"
      aria-label={t("common.refresh")}
      title={t("common.refresh")}
    >
      <RefreshCw
        className={cn(
          "h-4 w-4",
          (callLoading || transcriptLoading) && "animate-spin",
        )}
        aria-hidden="true"
      />
    </button>
  );

  if (!call && callLoading) {
    return (
      <AppShell title={t("calls.detailsTitle")} actions={backLink}>
        <div className="space-y-3">
          <span className="skeleton block h-32 w-full" />
          <span className="skeleton block h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!call) {
    const missing = callFailure?.status === 404 || callFailure?.status === 400;

    const forbidden = callFailure?.status === 403;

    return (
      <AppShell title={t("calls.detailsTitle")} actions={backLink}>
        <div className="card">
          <EmptyState
            icon={
              missing ? (
                <PhoneOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              )
            }
            title={
              missing
                ? t("calls.notFound")
                : forbidden
                  ? t("calls.forbidden")
                  : t(callFailure?.key ?? "errors.generic")
            }
            action={
              missing || forbidden ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => router.push("/calls")}
                >
                  {t("calls.backToList")}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void loadCall()}
                >
                  {t("common.retry")}
                </button>
              )
            }
          />
        </div>
      </AppShell>
    );
  }

  const name = call.customerName?.trim() || call.phone;

  return (
    <AppShell
      title={t("calls.detailsTitle")}
      subtitle={name}
      actions={
        <div className="flex items-center gap-2">
          {refreshButton}
          {backLink}
        </div>
      }
    >
      <section className="card mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={call.customerName} seed={call.phone} size="lg" />
            <div className="min-w-0">
              <h2
                dir={call.customerName?.trim() ? textDirOf(name) : "ltr"}
                className="truncate text-base font-semibold text-ink-900 dark:text-ink-50"
              >
                {name}
              </h2>
              {call.customerName?.trim() ? (
                <p dir="ltr" className="text-xs text-ink-500 dark:text-ink-400">
                  {call.phone}
                </p>
              ) : (
                <p className="text-xs text-ink-400">{t("calls.noCustomer")}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CallStatusBadge status={call.status} />
            {call.conversationId ? (
              <Link
                href={`/conversations?id=${call.conversationId}`}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                {t("calls.openConversation")}
              </Link>
            ) : null}
          </div>
        </div>

        {call.status === "unknown" ? (
          <p
            role="status"
            className="mt-4 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:bg-violet-900/30 dark:text-violet-100"
          >
            {t("calls.unknownHint")}
          </p>
        ) : null}

        {!call.conversationId ? (
          <p className="mt-4 text-xs text-ink-400">
            {t("calls.noConversation")}
          </p>
        ) : null}

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("calls.col.direction")}>
            <CallDirection direction={call.direction} />
          </Field>
          <Field label={t("calls.col.channel")}>
            <span className="uppercase">{call.channel || "—"}</span>
          </Field>
          <Field label={t("calls.fields.startedAt")}>
            {formatDateTime(call.startedAt)}
          </Field>
          <Field label={t("calls.fields.answeredAt")}>
            {call.answeredAt ? formatDateTime(call.answeredAt) : "—"}
          </Field>
          <Field label={t("calls.fields.endedAt")}>
            {call.endedAt ? formatDateTime(call.endedAt) : "—"}
          </Field>
          <Field label={t("calls.col.duration")}>
            <CallDuration call={call} />
          </Field>
          <Field label={t("calls.col.talk")}>
            <CallDuration call={call} field="talkDurationMs" />
          </Field>
          <Field label={t("calls.fields.endCause")}>
            <span dir="ltr">{call.endCause ?? "—"}</span>
          </Field>
          <Field label={t("calls.fields.lastObserved")}>
            {call.lastObservedAt ? formatDateTime(call.lastObservedAt) : "—"}
          </Field>
        </dl>
      </section>

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-3 dark:border-ink-700">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">
            {t("calls.transcript.title")}
          </h2>
          {transcript ? (
            <span className="badge bg-ink-100 tabular-nums text-ink-600 dark:bg-ink-700 dark:text-ink-200">
              {transcript.total ?? transcript.items.length}
            </span>
          ) : null}
        </header>

        <CallTranscript
          transcript={transcript}
          loading={transcriptLoading}
          failure={transcriptFailure}
          live={live}
          onRetry={() => void loadTranscript()}
        />
      </section>
    </AppShell>
  );
}
