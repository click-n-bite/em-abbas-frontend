"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { voiceApi } from "@/lib/features/voice/api";
import type { VoiceCallsPage } from "@/lib/features/voice/types";
import { usePoll } from "@/hooks/use-poll";
import { useVoiceEvents } from "@/hooks/use-voice-events";
import { useI18n } from "@/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { isActiveCall } from "@/lib/voice-format";
import { CallListItem } from "./call-list-item";

const PAGE_SIZE = 10;

interface Props {
  conversationId: string;
  active: boolean;
}

/** Calls linked to one conversation. Shown as a tab in the chat panel. */
export function ConversationCalls({ conversationId, active }: Props) {
  const { t } = useI18n();

  const [data, setData] = useState<VoiceCallsPage | null>(null);

  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(false);

  const [failure, setFailure] = useState<string | null>(null);

  const requestId = useRef(0);

  useEffect(() => {
    setPage(0);
    setData(null);
  }, [conversationId]);

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;

      if (!silent) setLoading(true);

      try {
        const result = await voiceApi.conversationCalls(conversationId, {
          page,
          size: PAGE_SIZE,
        });

        if (id !== requestId.current) return;

        setData(result);
        setFailure(null);
      } catch (error) {
        if (id !== requestId.current) return;

        if ((error as Error)?.name === "AbortError") return;

        // Keep the data we already have on a transient error.
        if (!silent || !data) {
          setFailure(
            error instanceof ApiError && error.status === 403
              ? "calls.forbidden"
              : errorKey(error),
          );
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, page],
  );

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  useVoiceEvents({
    topics: [`/topic/conversation/${conversationId}`],
    enabled: active,
    onRefresh: () => void load(true),
  });

  const hasLive = Boolean(
    data?.items.some((call) => isActiveCall(call.status)),
  );

  usePoll(() => void load(true), 30_000, active && hasLive);

  if (!active) return null;

  if (loading && !data) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2].map((index) => (
          <span key={index} className="skeleton block h-16 w-full" />
        ))}
      </div>
    );
  }

  if (failure && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<AlertCircle className="h-5 w-5" aria-hidden="true" />}
          title={t(failure)}
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void load()}
            >
              {t("common.retry")}
            </button>
          }
        />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<PhoneCall className="h-5 w-5" aria-hidden="true" />}
          title={t("calls.conversationEmpty")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <ul className="space-y-2 p-3 sm:p-4">
        {data.items.map((call) => (
          <CallListItem key={call.id} call={call} />
        ))}
      </ul>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 border-t border-ink-200 px-5 py-3 dark:border-ink-700">
          <button
            type="button"
            className="btn-ghost px-2.5"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            aria-label={t("common.previous")}
          >
            <ChevronLeft
              className="h-4 w-4 rtl:rotate-180"
              aria-hidden="true"
            />
          </button>
          <span className="text-xs text-ink-500 dark:text-ink-400">
            {page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            className="btn-ghost px-2.5"
            disabled={page + 1 >= data.totalPages}
            onClick={() =>
              setPage((value) => Math.min(data.totalPages - 1, value + 1))
            }
            aria-label={t("common.next")}
          >
            <ChevronRight
              className="h-4 w-4 rtl:rotate-180"
              aria-hidden="true"
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}
