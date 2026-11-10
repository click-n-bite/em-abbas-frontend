"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  BellOff,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ModeBadge } from "@/components/ui/badges";
import { Select } from "@/components/ui/select";
import { cn, textDirOf } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DEFAULT_PAGE_SIZE = 25;

type DateRange = "all" | "today" | "7d" | "30d";

function startOfDay(date: Date) {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;
}

function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);

  const items: (number | "gap")[] = [0];

  const start = Math.max(1, current - 1);

  const end = Math.min(total - 2, current + 1);

  if (start > 1) items.push("gap");

  for (let i = start; i <= end; i++) items.push(i);

  if (end < total - 2) items.push("gap");

  items.push(total - 1);

  return items;
}

export default function NotificationsPage() {
  const { t, formatDateTime, formatRelative } = useI18n();

  const {
    items,
    unread,
    loading,
    errorKey: failure,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  type NotificationItem = (typeof items)[number];

  const [onlyUnread, setOnlyUnread] = useState(false);

  const [query, setQuery] = useState("");

  const [range, setRange] = useState<DateRange>("all");

  const [page, setPage] = useState(0);

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const listRef = useRef<HTMLDivElement | null>(null);

  const tableRef = useRef<HTMLDivElement | null>(null);

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    let list = onlyUnread ? items.filter((item) => !item.read) : items;

    if (range !== "all") {
      const cutoffDays = range === "today" ? 0 : range === "7d" ? 7 : 30;

      const cutoff = startOfDay(now).getTime() - cutoffDays * 86_400_000;

      list = list.filter(
        (item) => new Date(item.createdAt).getTime() >= cutoff,
      );
    }

    const q = query.trim().toLowerCase();

    if (q) {
      list = list.filter((item) => {
        const haystack = [
          item.title,
          item.body,
          item.preview,
          item.phone,
          item.customerName,
          item.serviceName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    return list;
  }, [items, onlyUnread, range, query, now]);

  const total = filtered.length;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const currentPage = Math.min(page, totalPages - 1);

  const pageItems = filtered.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    tableRef.current?.scrollTo({ top: 0 });
  }, [currentPage, pageSize]);

  const derive = (item: NotificationItem) => {
    const summary =
      item.customerName && item.serviceName
        ? [item.customerName, item.serviceName, item.phone]
            .filter(Boolean)
            .join(" · ")
        : null;

    const body =
      item.body?.trim() === summary || item.body?.trim() === item.phone
        ? null
        : item.body;

    const showPhone = Boolean(
      item.phone &&
        !body?.includes(item.phone) &&
        !item.preview?.includes(item.phone),
    );

    return { body, showPhone };
  };

  const renderActions = (item: NotificationItem, align: "end" | "stretch") => {
    if (!item.leadId && !item.conversationId && item.read) return null;

    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          align === "end" ? "justify-end" : "justify-start",
        )}
      >
        {item.leadId ? (
          <Link
            href={`/leads/${item.leadId}`}
            className="btn-primary min-h-8 rounded-lg px-3 py-1 text-xs"
            onClick={() => {
              if (!item.read) void markRead(item.id);
            }}
          >
            {t("notifications.viewLead")}
            <ArrowUpRight
              className="h-3.5 w-3.5 rtl:-rotate-90"
              aria-hidden="true"
            />
          </Link>
        ) : null}
        {item.conversationId ? (
          <Link
            href={`/conversations?id=${item.conversationId}`}
            className={cn(
              item.leadId ? "btn-secondary" : "btn-primary",
              "min-h-8 rounded-lg px-3 py-1 text-xs",
            )}
            onClick={() => {
              if (!item.read) void markRead(item.id);
            }}
          >
            {t("notifications.open")}
            <ArrowUpRight
              className="h-3.5 w-3.5 rtl:-rotate-90"
              aria-hidden="true"
            />
          </Link>
        ) : null}
        {!item.read ? (
          <button
            type="button"
            className="btn-ghost h-8 w-8 shrink-0 p-0"
            onClick={() => void markRead(item.id)}
            aria-label={t("notifications.markRead")}
            title={t("notifications.markRead")}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <AppShell
      title={t("notifications.title")}
      subtitle={failure ? t(failure) : t("notifications.subtitle")}
      actions={
        <div className="flex items-center gap-2">
          {unread > 0 ? (
            <button
              type="button"
              className="btn-secondary whitespace-nowrap px-3 py-2"
              onClick={() => void markAllRead()}
              aria-label={t("notifications.markAllRead")}
              title={t("notifications.markAllRead")}
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                {t("notifications.markAllRead")}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            className="btn-secondary px-3 py-2"
            aria-label={t("common.refresh")}
            title={t("common.refresh")}
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        </div>
      }
    >
      <section className="card flex h-[calc(100dvh-8.5rem)] min-h-[28rem] flex-col overflow-hidden lg:h-[calc(100dvh-9rem)] lg:min-h-[24rem]">
        <header className="shrink-0 border-b border-ink-200 p-2 dark:border-ink-700 lg:px-4 lg:py-3">
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
            <div className="relative min-w-0 flex-1 lg:w-[22rem] lg:flex-none">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder={t("notifications.searchPlaceholder")}
                aria-label={t("notifications.searchLabel")}
                className="input h-11 w-full ps-9 lg:h-10"
              />
            </div>

            <div className="relative min-w-24 shrink-0">
              <CalendarDays
                className="pointer-events-none absolute start-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-ink-400 sm:block"
                aria-hidden="true"
              />
              <Select
                value={range}
                onChange={(event) => {
                  setRange(event.target.value as DateRange);
                  setPage(0);
                }}
                aria-label={t("notifications.dateFilter")}
                className="h-11 sm:ps-9 lg:h-10"
              >
                <option value="all">{t("notifications.rangeAll")}</option>
                <option value="today">{t("notifications.rangeToday")}</option>
                <option value="7d">{t("notifications.range7d")}</option>
                <option value="30d">{t("notifications.range30d")}</option>
              </Select>
            </div>

            <div
              role="tablist"
              aria-label={t("notifications.title")}
              className="flex w-full items-center gap-1 rounded-xl bg-ink-50 p-1 dark:bg-ink-900 lg:w-auto lg:shrink-0"
            >
              {[
                {
                  value: false,
                  label: t("notifications.tabAll"),
                  count: items.length,
                },
                {
                  value: true,
                  label: t("notifications.tabUnread"),
                  count: unread,
                },
              ].map((tab) => (
                <button
                  key={String(tab.value)}
                  type="button"
                  role="tab"
                  aria-selected={onlyUnread === tab.value}
                  onClick={() => {
                    setOnlyUnread(tab.value);
                    setPage(0);
                  }}
                  className={cn(
                    "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition lg:min-h-0 lg:flex-none lg:px-3 lg:py-1.5 lg:text-xs",
                    onlyUnread === tab.value
                      ? "bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-brand-100"
                      : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      onlyUnread === tab.value
                        ? "bg-brand-600 text-white"
                        : "bg-ink-200 dark:bg-ink-700",
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </header>
        <div
          ref={listRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden"
        >
          {loading && items.length === 0 ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-5 w-5" aria-hidden="true" />}
              title={t("notifications.empty")}
            />
          ) : (
            <>
              <ul
                aria-label={t("notifications.title")}
                className="space-y-3 bg-ink-50/50 p-3 dark:bg-ink-900/20 lg:hidden"
              >
                {pageItems.map((item) => {
                  const { body, showPhone } = derive(item);

                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-xl border bg-white p-3 dark:bg-ink-800",
                        !item.read
                          ? "border-brand-200 dark:border-brand-800"
                          : "border-ink-200 dark:border-ink-700",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="relative shrink-0">
                          {!item.read ? (
                            <>
                              <span
                                className="absolute -start-1 -top-1 z-10 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white dark:ring-ink-800"
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                {t("notifications.tabUnread")}
                              </span>
                            </>
                          ) : null}
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-400"
                            aria-hidden="true"
                          >
                            <Bell className="h-4 w-4" />
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              dir={textDirOf(item.customerName || item.title)}
                              className="min-w-0 break-words text-sm font-semibold leading-5 text-ink-900 dark:text-ink-50"
                            >
                              {item.customerName || item.title}
                            </p>
                            <time
                              dateTime={item.createdAt}
                              title={formatDateTime(item.createdAt)}
                              className="shrink-0 whitespace-nowrap text-xs text-ink-500 dark:text-ink-400"
                            >
                              {formatRelative(item.createdAt)}
                            </time>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {item.customerName ? (
                              <span className="max-w-full break-words rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                                {item.title}
                              </span>
                            ) : null}
                            {item.mode ? <ModeBadge mode={item.mode} /> : null}
                          </div>

                          <div className="mt-2 space-y-0.5">
                            {item.customerName && item.serviceName ? (
                              <p className="break-words text-sm leading-5 text-ink-700 dark:text-ink-200">
                                <bdi dir={textDirOf(item.serviceName)}>
                                  {item.serviceName}
                                </bdi>
                              </p>
                            ) : null}
                            {body ? (
                              <p className="break-words text-sm leading-5 text-ink-600 dark:text-ink-300">
                                <bdi dir={textDirOf(body)}>{body}</bdi>
                              </p>
                            ) : null}
                            {showPhone ? (
                              <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                                <Phone
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <bdi dir="ltr">{item.phone}</bdi>
                              </p>
                            ) : null}
                            {item.preview ? (
                              <p className="line-clamp-2 break-words text-xs text-ink-500 dark:text-ink-400">
                                <bdi dir={textDirOf(item.preview)}>
                                  {item.preview}
                                </bdi>
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {item.leadId || item.conversationId || !item.read ? (
                        <div className="mt-2 border-t border-ink-100 pt-2 dark:border-ink-700">
                          {renderActions(item, "end")}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div
                ref={tableRef}
                className="hidden min-h-0 flex-1 overflow-auto lg:block"
              >
                <table className="w-full min-w-[60rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-ink-50 text-center text-xs font-semibold uppercase tracking-wide text-ink-400 shadow-[0_1px_0_0] shadow-ink-200 dark:bg-ink-800 dark:text-ink-500 dark:shadow-ink-700">
                      <th className="px-5 py-2.5 text-center">
                        {t("notifications.title")}
                      </th>
                      <th className="px-3 py-2.5 text-center">
                        {t("notifications.colDetails")}
                      </th>
                      {/* <th className="px-3 py-2.5 text-center">
                        {t("notifications.colMode")}
                      </th> */}
                      <th className="px-3 py-2.5 text-center">
                        {t("notifications.colTime")}
                      </th>
                      <th className="px-5 py-2.5 text-center">
                        {t("notifications.colActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-700/70">
                    {pageItems.map((item) => {
                      const { body, showPhone } = derive(item);

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "align-top transition",
                            !item.read
                              ? "bg-brand-50/40 hover:bg-brand-50/70 dark:bg-brand-900/10 dark:hover:bg-brand-900/20"
                              : "hover:bg-ink-50/60 dark:hover:bg-ink-800/30",
                          )}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="relative shrink-0">
                                {!item.read ? (
                                  <>
                                    <span
                                      className="absolute -start-1 -top-1 z-10 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white dark:ring-ink-800"
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                      {t("notifications.tabUnread")}
                                    </span>
                                  </>
                                ) : null}
                                <span
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-400"
                                  aria-hidden="true"
                                >
                                  <Bell className="h-4 w-4" />
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p
                                  dir={textDirOf(
                                    item.customerName || item.title,
                                  )}
                                  className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50"
                                >
                                  {item.customerName || item.title}
                                </p>
                                {item.customerName ? (
                                  <span className="mt-0.5 inline-block max-w-[14rem] truncate rounded-md bg-brand-50 px-2 py-0.5 align-top text-[11px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                                    {item.title}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <div className="max-w-[22rem] space-y-0.5">
                              {item.customerName && item.serviceName ? (
                                <p className="break-words text-sm leading-5 text-ink-800 dark:text-ink-100">
                                  <bdi dir={textDirOf(item.serviceName)}>
                                    {item.serviceName}
                                  </bdi>
                                </p>
                              ) : null}
                              {body ? (
                                <p className="break-words text-sm leading-5 text-ink-600 dark:text-ink-300">
                                  <bdi dir={textDirOf(body)}>{body}</bdi>
                                </p>
                              ) : null}
                              {showPhone ? (
                                <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                                  <Phone
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <bdi dir="ltr">{item.phone}</bdi>
                                </p>
                              ) : null}
                              {item.preview ? (
                                <p className="line-clamp-2 break-words text-xs text-ink-500 dark:text-ink-400">
                                  <bdi dir={textDirOf(item.preview)}>
                                    {item.preview}
                                  </bdi>
                                </p>
                              ) : null}
                            </div>
                          </td>

                          {/* <td className="px-3 py-3 text-center">
                            {item.mode ? <ModeBadge mode={item.mode} /> : null}
                          </td> */}

                          <td
                            className="whitespace-nowrap px-3 py-3 text-center text-xs text-ink-500 dark:text-ink-400"
                            title={formatDateTime(item.createdAt)}
                          >
                            <time dateTime={item.createdAt}>
                              {formatRelative(item.createdAt)}
                            </time>
                          </td>

                          <td className="px-5 py-3">
                            {renderActions(item, "end")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {total > 0 ? (
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-ink-200 px-3 py-2.5 dark:border-ink-700 sm:px-5 sm:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="hidden whitespace-nowrap text-xs text-ink-500 dark:text-ink-400 lg:inline">
                  {t("notifications.rowsPerPage")}
                </span>
                <Select
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                  className="h-9 min-w-0 ps-2 pe-8"
                  wrapperClassName="w-auto flex-none"
                  mobileLabel={String(pageSize)}
                  aria-label={t("notifications.rowsPerPage")}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {totalPages > 1 ? (
              <nav
                aria-label={t("notifications.title")}
                className="flex shrink-0 items-center gap-1"
              >
                <button
                  type="button"
                  className="btn-ghost h-9 w-9 p-0 sm:h-8 sm:w-8"
                  disabled={currentPage === 0}
                  onClick={() => setPage(Math.max(0, currentPage - 1))}
                  aria-label={t("notifications.prevPage")}
                >
                  <ChevronLeft
                    className="h-4 w-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </button>

                <span
                  dir="ltr"
                  className="min-w-12 text-center text-xs font-medium tabular-nums text-ink-600 dark:text-ink-300 sm:hidden"
                  aria-live="polite"
                >
                  {currentPage + 1} / {totalPages}
                </span>

                <div className="hidden items-center gap-1 sm:flex">
                  {pageNumbers(currentPage, totalPages).map((item, index) =>
                    item === "gap" ? (
                      <span
                        key={`gap-${index}`}
                        className="px-1 text-xs text-ink-400"
                        aria-hidden="true"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        aria-current={item === currentPage ? "page" : undefined}
                        className={cn(
                          "h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular-nums transition",
                          item === currentPage
                            ? "bg-brand-600 text-white shadow-sm"
                            : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700",
                        )}
                      >
                        {item + 1}
                      </button>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  className="btn-ghost h-9 w-9 p-0 sm:h-8 sm:w-8"
                  disabled={currentPage + 1 >= totalPages}
                  onClick={() =>
                    setPage(Math.min(totalPages - 1, currentPage + 1))
                  }
                  aria-label={t("notifications.nextPage")}
                >
                  <ChevronRight
                    className="h-4 w-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </button>
              </nav>
            ) : null}
          </footer>
        ) : null}
      </section>
    </AppShell>
  );
}
