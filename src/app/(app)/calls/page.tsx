"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Search,
} from "lucide-react";
import { errorKey } from "@/lib/errors";
import { voiceApi } from "@/lib/features/voice/api";
import type {
  VoiceCall,
  VoiceCallStatusFilter,
} from "@/lib/features/voice/types";
import { dayEndExclusiveIso, dayStartIso } from "@/lib/voice-format";
import { usePoll } from "@/hooks/use-poll";
import { useVoiceEvents } from "@/hooks/use-voice-events";
import { useI18n } from "@/providers/i18n-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import {
  CallDirection,
  CallDuration,
  CallStatusBadge,
} from "@/components/voice/call-badges";
import { CallListItem } from "@/components/voice/call-list-item";
import { cn, textDirOf } from "@/lib/utils";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: VoiceCallStatusFilter[] = [
  "all",
  "active",
  "completed",
  "missed",
  "rejected",
  "failed",
  "unknown",
];

/** Channels the portal knows about; others seen in data are added too. */
const BASE_CHANNELS = ["sip"];

function LiveCalls({
  calls,
  loading,
}: {
  calls: VoiceCall[];
  loading: boolean;
}) {
  const { t, formatTime } = useI18n();

  return (
    <section className="card mb-4 overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-3 dark:border-ink-700">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            {calls.length > 0 ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            ) : null}
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full",
                calls.length > 0
                  ? "bg-emerald-500"
                  : "bg-ink-300 dark:bg-ink-600",
              )}
            />
          </span>
          {t("calls.liveTitle")}
          <span className="badge bg-ink-100 tabular-nums text-ink-600 dark:bg-ink-700 dark:text-ink-200">
            {calls.length}
          </span>
        </h2>
      </header>

      {loading && calls.length === 0 ? (
        <div className="p-4">
          <span className="skeleton block h-10 w-full" />
        </div>
      ) : calls.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-500 dark:text-ink-400">
          {t("calls.liveEmpty")}
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 dark:divide-ink-700/70">
          {calls.map((call) => {
            const name = call.customerName?.trim() || call.phone;

            return (
              <li key={call.id}>
                <Link
                  href={`/calls/${encodeURIComponent(call.id)}`}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50 dark:hover:bg-ink-700/50"
                >
                  <Avatar name={call.customerName} seed={call.phone} />
                  <span className="min-w-0 flex-1">
                    <span
                      dir={call.customerName?.trim() ? textDirOf(name) : "ltr"}
                      className="block truncate text-sm font-medium text-ink-900 dark:text-ink-50"
                    >
                      {name}
                    </span>
                    <span className="block text-xs text-ink-500 dark:text-ink-400">
                      {t("calls.startedAtTime", {
                        time: formatTime(call.startedAt),
                      })}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <CallStatusBadge status={call.status} />
                    <span className="text-xs font-medium text-ink-700 dark:text-ink-200">
                      <CallDuration call={call} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function CallsPage() {
  const router = useRouter();

  const { t, formatDateTime } = useI18n();

  const [calls, setCalls] = useState<VoiceCall[]>([]);

  const [total, setTotal] = useState(0);

  const [totalPages, setTotalPages] = useState(1);

  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);

  const [failure, setFailure] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");

  const [search, setSearch] = useState("");

  const [status, setStatus] = useState<VoiceCallStatusFilter>("all");

  const [channel, setChannel] = useState("all");

  const [fromDay, setFromDay] = useState("");

  const [toDay, setToDay] = useState("");

  const [knownChannels, setKnownChannels] = useState<string[]>(BASE_CHANNELS);

  const [liveCalls, setLiveCalls] = useState<VoiceCall[]>([]);

  const [liveLoading, setLiveLoading] = useState(true);

  const requestId = useRef(0);

  const rangeInvalid = Boolean(fromDay && toDay && fromDay > toDay);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async (silent = false) => {
      if (rangeInvalid) {
        setFailure("calls.invalidRange");
        setLoading(false);

        return;
      }

      const id = ++requestId.current;

      if (!silent) setLoading(true);

      try {
        const result = await voiceApi.list({
          search: search || undefined,
          channel: channel === "all" ? undefined : channel.toUpperCase(),
          status,
          from: fromDay ? dayStartIso(fromDay) : undefined,
          to: toDay ? dayEndExclusiveIso(toDay) : undefined,
          page,
          size: PAGE_SIZE,
        });

        if (id !== requestId.current) return;

        setCalls(result.items);
        setTotal(result.total);
        setTotalPages(Math.max(1, result.totalPages));
        setFailure(null);
        setKnownChannels((current) => {
          const next = new Set(current);

          result.items.forEach((call) => {
            if (call.channel) next.add(call.channel.toLowerCase());
          });

          return next.size === current.length ? current : [...next];
        });
      } catch (error) {
        if (id !== requestId.current) return;

        // Keep the page we already show on a transient failure.
        if (!silent || calls.length === 0) setFailure(errorKey(error));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, channel, status, fromDay, toDay, page, rangeInvalid],
  );

  const loadLive = useCallback(async () => {
    try {
      const result = await voiceApi.list({
        status: "active",
        page: 0,
        size: 50,
      });

      setLiveCalls(result.items);
    } catch {
      // Keep the last known live calls.
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadLive();
  }, [loadLive]);

  const refreshAll = useCallback(() => {
    void load(true);
    void loadLive();
  }, [load, loadLive]);

  useVoiceEvents({
    topics: ["/topic/voice/calls"],
    onRefresh: refreshAll,
  });

  usePoll(() => void loadLive(), 30_000, liveCalls.length > 0);

  const changeFilter =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(0);
    };

  const channelOptions = [...new Set(knownChannels)];

  const hasFilters =
    Boolean(search) ||
    status !== "all" ||
    channel !== "all" ||
    fromDay ||
    toDay;

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setChannel("all");
    setFromDay("");
    setToDay("");
    setPage(0);
  };

  return (
    <AppShell
      title={t("calls.title")}
      subtitle={failure ? t(failure) : t("calls.subtitle")}
      actions={
        <button
          type="button"
          onClick={refreshAll}
          className="btn-secondary px-3 py-2"
          aria-label={t("common.refresh")}
          title={t("common.refresh")}
        >
          <RefreshCw
            className={cn("h-4 w-4", loading && "animate-spin")}
            aria-hidden="true"
          />
        </button>
      }
    >
      <LiveCalls calls={liveCalls} loading={liveLoading} />

      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-end gap-2 border-b border-ink-200 p-3 dark:border-ink-700 lg:px-4">
          <div className="relative w-full min-w-0 sm:w-auto sm:min-w-56 sm:flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("calls.searchPlaceholder")}
              aria-label={t("common.search")}
              className="input h-10 w-full ps-10"
            />
          </div>

          <Select
            value={status}
            onChange={(event) =>
              changeFilter(setStatus)(
                event.target.value as VoiceCallStatusFilter,
              )
            }
            aria-label={t("calls.col.status")}
            className="h-10"
            wrapperClassName="w-[calc(50%-0.25rem)] sm:w-auto"
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "all"
                  ? t("calls.filters.allStatuses")
                  : t(`calls.status.${value}`)}
              </option>
            ))}
          </Select>

          <Select
            value={channel}
            onChange={(event) => changeFilter(setChannel)(event.target.value)}
            aria-label={t("calls.col.channel")}
            className="h-10"
            wrapperClassName="w-[calc(50%-0.25rem)] sm:w-auto"
          >
            <option value="all">{t("calls.filters.allChannels")}</option>
            {channelOptions.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </Select>

          <label className="flex w-[calc(50%-0.25rem)] flex-col gap-1 text-[11px] text-ink-500 dark:text-ink-400 sm:w-auto">
            {t("calls.filters.from")}
            <input
              type="date"
              value={fromDay}
              max={toDay || undefined}
              onChange={(event) => changeFilter(setFromDay)(event.target.value)}
              className="input h-10"
            />
          </label>

          <label className="flex w-[calc(50%-0.25rem)] flex-col gap-1 text-[11px] text-ink-500 dark:text-ink-400 sm:w-auto">
            {t("calls.filters.to")}
            <input
              type="date"
              value={toDay}
              min={fromDay || undefined}
              onChange={(event) => changeFilter(setToDay)(event.target.value)}
              className="input h-10"
            />
          </label>

          {hasFilters ? (
            <button
              type="button"
              className="btn-ghost h-10"
              onClick={clearFilters}
            >
              {t("calls.filters.clear")}
            </button>
          ) : null}
        </header>

        {loading && calls.length === 0 ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : failure && calls.length === 0 ? (
          <EmptyState
            icon={<PhoneCall className="h-5 w-5" aria-hidden="true" />}
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
        ) : calls.length === 0 ? (
          <EmptyState
            icon={<PhoneCall className="h-5 w-5" aria-hidden="true" />}
            title={t("calls.empty")}
          />
        ) : (
          <>
            <ul
              aria-label={t("calls.historyTitle")}
              className="space-y-2 bg-ink-50/50 p-3 dark:bg-ink-900/20 lg:hidden"
            >
              {calls.map((call) => (
                <CallListItem key={call.id} call={call} />
              ))}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[60rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-500">
                    <th className="px-5 py-2.5 text-start">
                      {t("calls.col.caller")}
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      {t("calls.col.status")}
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      {t("calls.col.direction")}
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      {t("calls.col.channel")}
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      {t("calls.col.started")}
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      {t("calls.col.duration")}
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      {t("calls.col.talk")}
                    </th>
                    <th className="px-5 py-2.5 text-end" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-700/70">
                  {calls.map((call) => {
                    const name = call.customerName?.trim() || call.phone;

                    return (
                      <tr
                        key={call.id}
                        onClick={() =>
                          router.push(`/calls/${encodeURIComponent(call.id)}`)
                        }
                        className="cursor-pointer align-middle transition hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={call.customerName}
                              seed={call.phone}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p
                                dir={
                                  call.customerName?.trim()
                                    ? textDirOf(name)
                                    : "ltr"
                                }
                                className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50"
                              >
                                {name}
                              </p>
                              {call.customerName?.trim() ? (
                                <p
                                  dir="ltr"
                                  className="text-xs text-ink-500 dark:text-ink-400"
                                >
                                  {call.phone}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <CallStatusBadge status={call.status} />
                        </td>
                        <td className="px-3 py-3">
                          <CallDirection direction={call.direction} />
                        </td>
                        <td className="px-3 py-3 text-xs uppercase text-ink-500 dark:text-ink-400">
                          {call.channel}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-500 dark:text-ink-400">
                          {formatDateTime(call.startedAt)}
                        </td>
                        <td className="px-3 py-3 text-xs text-ink-700 dark:text-ink-200">
                          <CallDuration call={call} />
                        </td>
                        <td className="px-3 py-3 text-xs text-ink-700 dark:text-ink-200">
                          <CallDuration call={call} field="talkDurationMs" />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/calls/${encodeURIComponent(call.id)}`}
                              onClick={(event) => event.stopPropagation()}
                              className="btn-secondary px-2.5 py-1.5 text-xs"
                              aria-label={t("calls.viewDetails")}
                              title={t("calls.viewDetails")}
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                            {call.conversationId ? (
                              <Link
                                href={`/conversations?id=${call.conversationId}`}
                                onClick={(event) => event.stopPropagation()}
                                className="btn-primary px-2.5 py-1.5 text-xs"
                                aria-label={t("calls.openConversation")}
                                title={t("calls.openConversation")}
                              >
                                <MessageSquare
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-ink-200 px-5 py-3 dark:border-ink-700">
          <span className="text-xs text-ink-500 dark:text-ink-400">
            {t("calls.totalResults", { n: total })}
          </span>

          {totalPages > 1 ? (
            <div className="flex items-center gap-3">
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
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-ghost px-2.5"
                disabled={page + 1 >= totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages - 1, value + 1))
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
        </footer>
      </section>
    </AppShell>
  );
}
