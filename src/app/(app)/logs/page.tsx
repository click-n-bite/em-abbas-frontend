/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  User,
  Shield,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import {
  SortControl,
  SortableColumnHeader,
} from "@/components/ui/sortable-header";
import { toggleSort, type SortState } from "@/lib/sorting";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  ActivityActorType,
  ActivityEventType,
  ConversationActivityEvent,
  ConversationActivityResponse,
  Conversation,
} from "@/lib/types";

const EVENT_ICONS: Record<ActivityEventType, React.ReactNode> = {
  "ai.started": <Bot className="h-4 w-4" />,
  "handoff.requested": <Bot className="h-4 w-4" />,
  "agent.took_over": <User className="h-4 w-4" />,
  handed_to_ai: <Bot className="h-4 w-4" />,
  "number.blocked": <Shield className="h-4 w-4" />,
  "number.unblocked": <Shield className="h-4 w-4" />,
  "conversation.hidden": <Activity className="h-4 w-4" />,
  "conversation.unhidden": <Activity className="h-4 w-4" />,
  "conversation.cleared": <Activity className="h-4 w-4" />,
  "conversation.renamed": <Activity className="h-4 w-4" />,
};

const ACTOR_ICONS: Record<ActivityActorType, React.ReactNode> = {
  user: <User className="h-4 w-4" />,
  bot: <Bot className="h-4 w-4" />,
  system: <Shield className="h-4 w-4" />,
};

const EVENT_COLORS: Record<ActivityEventType, string> = {
  "ai.started":
    "text-brand-600 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-200",
  "handoff.requested":
    "text-amber-600 bg-amber-50 dark:bg-amber-900/40 dark:text-amber-200",
  "agent.took_over":
    "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-200",
  handed_to_ai:
    "text-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-200",
  "number.blocked":
    "text-rose-600 bg-rose-50 dark:bg-rose-900/40 dark:text-rose-200",
  "number.unblocked":
    "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-200",
  "conversation.hidden":
    "text-ink-500 bg-ink-100 dark:bg-ink-700/40 dark:text-ink-300",
  "conversation.unhidden":
    "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 dark:text-indigo-200",
  "conversation.cleared":
    "text-ink-500 bg-ink-100 dark:bg-ink-700/40 dark:text-ink-300",
  "conversation.renamed":
    "text-ink-500 bg-ink-100 dark:bg-ink-700/40 dark:text-ink-300",
};

const EVENT_LABELS: Record<ActivityEventType, string> = {
  "ai.started": "activity.events.ai.started",
  "handoff.requested": "activity.events.handoff.requested",
  "agent.took_over": "activity.events.agent.took_over",
  handed_to_ai: "activity.events.handed_to_ai",
  "number.blocked": "activity.events.number.blocked",
  "number.unblocked": "activity.events.number.unblocked",
  "conversation.hidden": "activity.events.conversation.hidden",
  "conversation.unhidden": "activity.events.conversation.unhidden",
  "conversation.cleared": "activity.events.conversation.cleared",
  "conversation.renamed": "activity.events.conversation.renamed",
};

const PAGE_SIZE = 5;

type DateRangeFilter = "today" | "7d" | "30d" | "all";

// The Logs page merges events from many conversations, so the API's
// per-conversation sorting can't order the combined list. It is sorted here.
type LogSortField = "occurredAt" | "eventType" | "actorName" | "conversation";

type LogSort = SortState<LogSortField>;

const DEFAULT_SORT: LogSort = { field: "occurredAt", direction: "desc" };

const SORT_FIELDS: LogSortField[] = [
  "occurredAt",
  "eventType",
  "actorName",
  "conversation",
];

const SORT_LABEL_KEYS: Record<LogSortField, string> = {
  occurredAt: "activity.colDateTime",
  eventType: "activity.colEvent",
  actorName: "activity.colActor",
  conversation: "activity.colConversation",
};

function compareEvents(
  a: ConversationActivityEvent,
  b: ConversationActivityEvent,
  sort: LogSort,
  labels: Map<string, ConversationLabel>,
): number {
  const dir = sort.direction === "asc" ? 1 : -1;

  const valueOf = (
    event: ConversationActivityEvent,
  ): string | number | null => {
    switch (sort.field) {
      case "occurredAt":
        return new Date(event.occurredAt).getTime();
      case "eventType":
        return event.eventType;
      case "actorName":
        return event.actorName?.trim() || null;
      case "conversation": {
        const label = labels.get(event.conversationId);

        return label?.name || label?.phone || event.conversationId;
      }
    }
  };

  const av = valueOf(a);

  const bv = valueOf(b);

  // Empty values sort last in either direction.
  if (av === null && bv === null) return (Number(a.id) - Number(b.id)) * dir;

  if (av === null) return 1;

  if (bv === null) return -1;

  const result =
    typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        });

  if (result !== 0) return result * dir;

  // Same tie-break as the API: id in the same direction.
  return (Number(a.id) - Number(b.id)) * dir;
}

interface ConversationLabel {
  name: string;
  phone: string;
}

function getEventColor(eventType: ActivityEventType): string {
  return (
    EVENT_COLORS[eventType] ||
    "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200"
  );
}

function getEventIcon(eventType: ActivityEventType): React.ReactNode {
  return EVENT_ICONS[eventType] || <Activity className="h-4 w-4" />;
}

function getActorIcon(actorType: ActivityActorType): React.ReactNode {
  return ACTOR_ICONS[actorType] || <User className="h-4 w-4" />;
}

function shortId(id: string, len = 10): string {
  if (!id) return "";

  return id.length > len ? `${id.slice(0, len)}…` : id;
}

function isWithinRange(dateStr: string, range: DateRangeFilter): boolean {
  if (range === "all") return true;

  const occurred = new Date(dateStr).getTime();

  const now = Date.now();

  if (range === "today") {
    const start = new Date();

    start.setHours(0, 0, 0, 0);

    return occurred >= start.getTime();
  }

  const days = range === "7d" ? 7 : 30;

  return now - occurred <= days * 24 * 60 * 60 * 1000;
}

export default function ActivityPage() {
  const { t, formatDateTime } = useI18n();

  const { push } = useToast();

  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [activities, setActivities] = useState<ConversationActivityResponse[]>(
    [],
  );

  const [filteredEvents, setFilteredEvents] = useState<
    ConversationActivityEvent[]
  >([]);

  const [total, setTotal] = useState(0);

  const [totalAll, setTotalAll] = useState(0);

  const [conversationLabels, setConversationLabels] = useState<
    Map<string, ConversationLabel>
  >(new Map());

  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(
    new Set(),
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [eventTypeFilter, setEventTypeFilter] = useState<
    ActivityEventType | "all"
  >("all");

  const [actorFilter, setActorFilter] = useState<ActivityActorType | "all">(
    "all",
  );

  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("7d");

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(0);

  const [sort, setSort] = useState<LogSort>(DEFAULT_SORT);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadActivities = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);

        const conversations = await api.conversations("all", signal);

        setConversationLabels(
          new Map(
            conversations.map((conv: Conversation) => [
              conv.id,
              {
                name: conv.customerName?.trim() ?? "",
                phone: conv.phone ?? "",
              },
            ]),
          ),
        );

        const activityPromises = conversations.map((conv) =>
          api.conversationActivity(conv.id, {}, signal).catch(() => null),
        );

        const results = await Promise.all(activityPromises);

        const validResults = results.filter(
          (r): r is ConversationActivityResponse => r !== null,
        );

        setActivities(validResults);
        setLastUpdated(new Date());
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;

        push(t("errors.generic"), "error");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [push, t],
  );

  useEffect(() => {
    const abortController = new AbortController();

    loadActivities(abortController.signal);

    return () => abortController.abort();
  }, [loadActivities]);

  useEffect(() => {
    let allEvents: ConversationActivityEvent[] = [];

    activities.forEach((activity) => {
      allEvents = [...allEvents, ...activity.events];
    });

    setTotalAll(allEvents.length);

    let filtered = [...allEvents];

    if (search.trim()) {
      const term = search.trim().toLowerCase();

      filtered = filtered.filter((event) => {
        const label = conversationLabels.get(event.conversationId);

        return (
          event.summary.toLowerCase().includes(term) ||
          event.actorName?.toLowerCase().includes(term) ||
          event.eventType.toLowerCase().includes(term) ||
          event.conversationId.toLowerCase().includes(term) ||
          Boolean(label?.name.toLowerCase().includes(term)) ||
          Boolean(label?.phone.toLowerCase().includes(term))
        );
      });
    }

    if (eventTypeFilter !== "all") {
      filtered = filtered.filter(
        (event) => event.eventType === eventTypeFilter,
      );
    }

    if (actorFilter !== "all") {
      filtered = filtered.filter((event) => event.actorType === actorFilter);
    }

    filtered = filtered.filter((event) =>
      isWithinRange(event.occurredAt, dateRangeFilter),
    );

    // Sort the full filtered list, then take the page.
    filtered.sort((a, b) => compareEvents(a, b, sort, conversationLabels));

    setTotal(filtered.length);

    const start = page * PAGE_SIZE;

    const end = start + PAGE_SIZE;

    setFilteredEvents(filtered.slice(start, end));
  }, [
    search,
    eventTypeFilter,
    actorFilter,
    dateRangeFilter,
    page,
    activities,
    conversationLabels,
    sort,
  ]);

  const changeSort = (next: LogSort) => {
    setSort(next);
    setPage(0);
  };

  const onHeaderSort = (field: LogSortField) =>
    changeSort(toggleSort(sort, field));

  const handleRefresh = () => {
    loadActivities();
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/conversations?id=${conversationId}`);
  };

  const toggleDetails = (eventId: string) => {
    setExpandedDetails((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }

      return newSet;
    });
  };

  const handleCopyId = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(conversationId);
      setCopiedId(conversationId);
      window.setTimeout(
        () =>
          setCopiedId((current) =>
            current === conversationId ? null : current,
          ),
        1500,
      );
    } catch {
      push(t("errors.generic"), "error");
    }
  };

  const customerDisplayOf = useCallback(
    (conversationId: string) => {
      const label = conversationLabels.get(conversationId);

      if (!label) return "";

      if (label.name && label.phone) return `${label.name} • ${label.phone}`;

      return label.name || label.phone || "";
    },
    [conversationLabels],
  );

  const relativeTime = useCallback(
    (dateStr: string) => {
      const diffMs = Date.now() - new Date(dateStr).getTime();

      const minutes = Math.floor(diffMs / 60000);

      if (minutes < 1) return t("common.justNow");

      if (minutes < 60) return t("common.minutesAgo", { n: minutes });

      const hours = Math.floor(minutes / 60);

      if (hours < 24) return t("common.hoursAgo", { n: hours });

      const days = Math.floor(hours / 24);

      return t("common.daysAgo", { n: days });
    },
    [t],
  );

  const uniqueEventTypes = useMemo(
    () =>
      Array.from(
        new Set(activities.flatMap((a) => a.events.map((e) => e.eventType))),
      ),
    [activities],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;

  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  const activeFilterCount =
    Number(eventTypeFilter !== "all") +
    Number(actorFilter !== "all") +
    Number(dateRangeFilter !== "all");

  return (
    <AppShell
      title={t("activity.title")}
      subtitle={t("activity.subtitle")}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="btn-secondary px-3 py-2"
            aria-label={t("common.refresh")}
            title={
              lastUpdated
                ? `${t("common.refresh")} · ${t("activity.lastUpdated", { time: formatDateTime(lastUpdated.toISOString()) })}`
                : t("common.refresh")
            }
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        </div>
      }
    >
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-4 py-3 dark:border-ink-700">
          <div className="relative min-w-0 flex-1 md:basis-full xl:basis-0">
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={t("activity.searchPlaceholder")}
              aria-label={t("common.search")}
              className="input h-10 w-full ps-10"
            />
          </div>

          <button
            type="button"
            className="btn-secondary h-10 shrink-0 gap-1.5 px-2.5 text-xs md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="activity-filter-controls"
            aria-label={t("activity.filtersCount", { n: activeFilterCount })}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>{t("activity.filters")}</span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          <div
            id="activity-filter-controls"
            className={cn(
              "w-full grid-cols-1 gap-2 md:grid md:grid-cols-3 xl:flex xl:w-auto",
              filtersOpen ? "grid" : "hidden",
            )}
          >
            <div className="min-w-0">
              <span className="sr-only">{t("activity.filterEventType")}</span>
              <Select
                value={eventTypeFilter}
                onChange={(e) => {
                  setEventTypeFilter(
                    e.target.value as ActivityEventType | "all",
                  );
                  setPage(0);
                }}
                className="h-10 min-w-0"
                aria-label={t("activity.filterEventType")}
              >
                <option value="all">{t("activity.eventTypeAll")}</option>
                {uniqueEventTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(EVENT_LABELS[type] || type)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="min-w-0">
              <span className="sr-only">{t("activity.filterActor")}</span>
              <Select
                value={actorFilter}
                onChange={(e) => {
                  setActorFilter(e.target.value as ActivityActorType | "all");
                  setPage(0);
                }}
                className="h-10 min-w-0"
                aria-label={t("activity.filterActor")}
              >
                <option value="all">{t("activity.actorAll")}</option>
                <option value="user">{t("activity.actorUser")}</option>
                <option value="bot">{t("activity.actorBot")}</option>
                <option value="system">{t("activity.actorSystem")}</option>
              </Select>
            </div>

            <div className="min-w-0">
              <span className="sr-only">{t("activity.filterDateRange")}</span>
              <Select
                value={dateRangeFilter}
                onChange={(e) => {
                  setDateRangeFilter(e.target.value as DateRangeFilter);
                  setPage(0);
                }}
                className="h-10 min-w-0"
                aria-label={t("activity.filterDateRange")}
              >
                <option value="today">{t("activity.rangeToday")}</option>
                <option value="7d">{t("activity.range7d")}</option>
                <option value="30d">{t("activity.range30d")}</option>
                <option value="all">{t("activity.rangeAll")}</option>
              </Select>
            </div>
          </div>
        </header>
        {/* Result count strip */}
        <div className="flex items-center justify-between border-b border-ink-200 bg-ink-50/50 px-5 py-2.5 text-xs text-ink-500 dark:border-ink-700 dark:bg-ink-800/30 dark:text-ink-400">
          <span className="font-medium text-ink-700 dark:text-ink-200">
            {t("activity.eventsCount", { count: total })}
          </span>
          <span>
            {t("activity.showingRange", {
              start: rangeStart,
              end: rangeEnd,
              total,
            })}
          </span>
        </div>

        <div className="border-b border-ink-200 px-4 py-2 dark:border-ink-700 sm:hidden">
          <SortControl
            sort={sort}
            onChange={changeSort}
            options={SORT_FIELDS.map((field) => ({
              field,
              label: t(SORT_LABEL_KEYS[field]),
            }))}
            selectClassName="h-10"
          />
        </div>

        <div
          role="row"
          className="hidden border-b border-ink-200 bg-ink-50/50 px-5 py-2.5 dark:border-ink-700 dark:bg-ink-800/30 sm:grid sm:grid-cols-12"
        >
          <SortableColumnHeader
            field="eventType"
            label={t(SORT_LABEL_KEYS.eventType)}
            sort={sort}
            onSort={onHeaderSort}
            className="col-span-3 text-center text-xs font-medium text-ink-500 dark:text-ink-400"
          />
          <SortableColumnHeader
            field="actorName"
            label={t(SORT_LABEL_KEYS.actorName)}
            sort={sort}
            onSort={onHeaderSort}
            className="col-span-2 text-center text-xs font-medium text-ink-500 dark:text-ink-400"
          />
          <SortableColumnHeader
            field="conversation"
            label={t(SORT_LABEL_KEYS.conversation)}
            sort={sort}
            onSort={onHeaderSort}
            className="col-span-2 text-center text-xs font-medium text-ink-500 dark:text-ink-400"
          />
          <SortableColumnHeader
            field="occurredAt"
            label={t(SORT_LABEL_KEYS.occurredAt)}
            sort={sort}
            onSort={onHeaderSort}
            className="col-span-2 text-center text-xs font-medium text-ink-500 dark:text-ink-400"
          />
          <div className="col-span-3 text-center text-xs font-medium text-ink-500 dark:text-ink-400">
            {t("activity.colActions")}
          </div>
        </div>

        {loading && filteredEvents.length === 0 ? (
          <ul className="space-y-3 p-5">
            {[0, 1, 2, 3].map((index) => (
              <li key={index} className="skeleton h-16 w-full" />
            ))}
          </ul>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-5 w-5" aria-hidden="true" />}
            title={t("activity.empty")}
          />
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-700/70">
            {filteredEvents.map((event) => {
              const isExpanded = expandedDetails.has(String(event.id));

              const hasPayload =
                event.payload && Object.keys(event.payload).length > 0;

              const customerLabel = customerDisplayOf(event.conversationId);

              const wasCopied = copiedId === event.conversationId;

              return (
                <li
                  key={event.id}
                  className="flex flex-col px-5 py-4 transition-colors hover:bg-ink-50/50 dark:hover:bg-ink-700/30"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center sm:gap-4">
                    {/* Event */}
                    <div className="flex items-start gap-3 sm:col-span-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          getEventColor(event.eventType),
                        )}
                      >
                        {getEventIcon(event.eventType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                          {t(EVENT_LABELS[event.eventType] || event.eventType)}
                        </p>
                        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                          {event.summary}
                        </p>
                      </div>
                    </div>

                    {/* Actor */}
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-300">
                        {getActorIcon(event.actorType)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">
                          {event.actorName || t("activity.unknownActor")}
                        </p>
                        <p className="text-xs capitalize text-ink-400 dark:text-ink-500">
                          {t(
                            `activity.actor${event.actorType.charAt(0).toUpperCase()}${event.actorType.slice(1)}` as any,
                          ) || event.actorType}
                        </p>
                      </div>
                    </div>

                    {/* Conversation */}
                    <div className="flex min-w-0 items-center gap-1.5 sm:col-span-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleConversationClick(event.conversationId)
                        }
                        className="min-w-0 truncate text-start text-sm text-brand-600 hover:underline dark:text-brand-300"
                        dir="auto"
                        title={customerLabel || event.conversationId}
                      >
                        {customerLabel || shortId(event.conversationId)}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(e, event.conversationId)}
                        className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 dark:hover:bg-ink-700"
                        aria-label={t("common.copy")}
                        title={
                          wasCopied ? t("common.copied") : t("common.copy")
                        }
                      >
                        {wasCopied ? (
                          <Check
                            className="h-3.5 w-3.5 text-emerald-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {/* Date */}
                    <div className="sm:col-span-2">
                      <p className="text-sm text-ink-700 dark:text-ink-300">
                        {formatDateTime(event.occurredAt)}
                      </p>
                      <p className="text-xs text-ink-400 dark:text-ink-500">
                        {relativeTime(event.occurredAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:col-span-3 sm:justify-end">
                      {hasPayload && (
                        <button
                          type="button"
                          onClick={() => toggleDetails(String(event.id))}
                          className="btn-ghost px-2 py-1.5 text-xs"
                          aria-label={
                            isExpanded
                              ? t("activity.hideDetails")
                              : t("activity.showDetails")
                          }
                        >
                          {isExpanded ? (
                            <ChevronUp
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronDown
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            {isExpanded
                              ? t("activity.hideDetails")
                              : t("activity.showDetails")}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          handleConversationClick(event.conversationId)
                        }
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        {t("activity.viewConversation")}
                        <ArrowRight
                          className="h-3.5 w-3.5 rtl:rotate-180"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>

                  {isExpanded && hasPayload && (
                    <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50/50 p-3 dark:border-ink-700 dark:bg-ink-800/30 sm:ms-[3.25rem]">
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {Object.entries(
                          event.payload as Record<string, unknown>,
                        ).map(([key, value]) => (
                          <div key={key} className="min-w-0">
                            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
                              {key}
                            </dt>
                            <dd
                              className="truncate text-sm text-ink-700 dark:text-ink-300"
                              title={String(value)}
                            >
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 border-t border-ink-200 px-5 py-3 dark:border-ink-700">
            <button
              type="button"
              className="btn-ghost px-2.5"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label={t("common.previous")}
            >
              <ChevronLeft
                className="h-4 w-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </button>
            <span className="text-xs text-ink-500 dark:text-ink-400">
              {t("activity.page", { page: page + 1, total: totalPages })}
            </span>
            <button
              type="button"
              className="btn-ghost px-2.5"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label={t("common.next")}
            >
              <ChevronRight
                className="h-4 w-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </button>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
