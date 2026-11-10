"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  PhoneOff,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { errorDetail, errorKey } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { FilterBar, FilterTabs } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BlockNumberFormModal } from "@/components/blocked-numbers/block-number-form-modal";
import { cn, textDirOf } from "@/lib/utils";
import type {
  BlockedNumbersStatusFilter,
  BlockedWhatsappNumber,
} from "@/lib/types";
import type { BlockNumberPayload } from "@/lib/api";

const STATUS_FILTERS: BlockedNumbersStatusFilter[] = [
  "blocked",
  "unblocked",
  "all",
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DEFAULT_PAGE_SIZE = 25;

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

function StatusPill({ entry }: { entry: BlockedWhatsappNumber }) {
  const { t } = useI18n();

  if (entry.localStatus === "unblocked") {
    return (
      <span className="badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200">
        <Undo2 className="h-3 w-3" aria-hidden="true" />
        {t("blockedNumbers.status.unblocked")}
      </span>
    );
  }

  if (entry.whatsappStatus === "blocked") {
    return (
      <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        {t("blockedNumbers.status.blocked")}
      </span>
    );
  }

  if (
    entry.whatsappStatus === "failed" ||
    entry.whatsappStatus === "unblocked"
  ) {
    return (
      <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {t("blockedNumbers.status.failed")}
      </span>
    );
  }

  return (
    <span className="badge bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200">
      <Clock3 className="h-3 w-3" aria-hidden="true" />
      {t("blockedNumbers.status.pending")}
    </span>
  );
}

export default function BlockedNumbersPage() {
  const { t, formatDateTime } = useI18n();

  const { role, ready, canManageBlockedNumbers } = useAuth();

  const { push } = useToast();

  const [entries, setEntries] = useState<BlockedWhatsappNumber[]>([]);

  const [loading, setLoading] = useState(true);

  const [failure, setFailure] = useState<string | null>(null);

  const [status, setStatus] = useState<BlockedNumbersStatusFilter>("blocked");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(0);

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [formOpen, setFormOpen] = useState(false);

  const [pendingUnblock, setPendingUnblock] =
    useState<BlockedWhatsappNumber | null>(null);

  const [busyUnblockId, setBusyUnblockId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!ready || !canManageBlockedNumbers) return;

      if (!silent) setLoading(true);

      try {
        const list = await adminApi.listBlockedNumbers(
          status,
          search.trim() || undefined,
        );

        setEntries(list);
        setFailure(null);
      } catch (error) {
        setFailure(errorKey(error));
      } finally {
        setLoading(false);
      }
    },
    [status, search, ready, canManageBlockedNumbers],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ready, canManageBlockedNumbers]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [status, search, pageSize]);

  const block = async (payload: BlockNumberPayload) => {
    try {
      const entry = await adminApi.blockNumber(payload);

      setEntries((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== entry.id);

        return status === "unblocked" && entry.localStatus === "blocked"
          ? withoutDuplicate
          : [entry, ...withoutDuplicate];
      });
      push(`${t("blockedNumbers.blocked")}: +${entry.phone}`, "success");
      setFormOpen(false);
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    }
  };

  const unblock = async (entry: BlockedWhatsappNumber) => {
    setBusyUnblockId(entry.id);

    try {
      const updated = await adminApi.unblockNumber(entry.id);

      setEntries((current) =>
        status === "blocked"
          ? current.filter((item) => item.id !== entry.id)
          : current.map((item) => (item.id === updated.id ? updated : item)),
      );
      push(t("blockedNumbers.unblocked"), "success");
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setBusyUnblockId(null);
    }
  };

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries],
  );

  const total = sorted.length;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const currentPage = Math.min(page, totalPages - 1);

  const pageItems = useMemo(
    () => sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    [sorted, currentPage, pageSize],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [currentPage, pageSize]);

  if (!canManageBlockedNumbers) {
    return (
      <AppShell title={t("blockedNumbers.title")}>
        <section className="card">
          <EmptyState
            icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
            title={t("blockedNumbers.forbidden")}
            description={`${t("settings.role")}: ${t(`users.roles.${role}`)}`}
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("blockedNumbers.title")}
      subtitle={failure ? t(failure) : t("blockedNumbers.subtitle")}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary px-3 py-2"
            aria-label={t("common.refresh")}
            title={t("common.refresh")}
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("blockedNumbers.block")}
          </button>
        </div>
      }
    >
      <section className="card flex flex-col overflow-hidden lg:h-full lg:min-h-[24rem]">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("blockedNumbers.searchPlaceholder")}
          searchLabel={t("common.search")}
          tabs={
            <FilterTabs
              label={t("blockedNumbers.listTitle")}
              value={status}
              options={STATUS_FILTERS.map((value) => ({
                value,
                label: t(`blockedNumbers.filters.${value}`),
                count: value === status ? total : null,
              }))}
              onChange={setStatus}
            />
          }
        />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          {loading && total === 0 ? (
            <ul className="space-y-3 p-5">
              {[0, 1, 2].map((index) => (
                <li key={index} className="skeleton h-12 w-full" />
              ))}
            </ul>
          ) : total === 0 ? (
            <EmptyState
              icon={<PhoneOff className="h-5 w-5" aria-hidden="true" />}
              title={t("blockedNumbers.empty")}
            />
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-700/70">
              {pageItems.map((entry) => (
                <li
                  key={entry.id}
                  className="animate-fade-in px-4 py-3.5 sm:px-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          dir="ltr"
                          className="min-w-0 break-all text-sm font-medium text-ink-900 dark:text-ink-50 sm:truncate"
                        >
                          +{entry.phone}
                        </p>
                        <span className="shrink-0 sm:hidden">
                          <StatusPill entry={entry} />
                        </span>
                      </div>

                      <p className="mt-0.5 break-words text-xs text-ink-500 dark:text-ink-400 sm:truncate">
                        {t("blockedNumbers.updatedAt")}{" "}
                        {formatDateTime(entry.updatedAt)}
                        {entry.reason ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="hidden sm:inline"
                            >
                              {" \u00b7 "}
                            </span>
                            <span
                              dir={textDirOf(entry.reason)}
                              title={entry.reason}
                              className="mt-0.5 block sm:mt-0 sm:inline"
                            >
                              {entry.reason}
                            </span>
                          </>
                        ) : null}
                      </p>

                      {entry.localStatus === "blocked" &&
                      entry.whatsappStatus === "failed" &&
                      entry.whatsappError ? (
                        <>
                          <p
                            className="mt-1 break-words text-xs text-amber-600 dark:text-amber-400 sm:truncate"
                            title={entry.whatsappError}
                          >
                            {entry.whatsappError}
                          </p>
                          <p className="break-words text-xs text-ink-500 dark:text-ink-400 sm:truncate">
                            {t("blockedNumbers.whatsappFailedHint")}
                          </p>
                        </>
                      ) : null}
                    </div>

                    <div className="hidden shrink-0 sm:block">
                      <StatusPill entry={entry} />
                    </div>

                    {entry.localStatus === "blocked" ? (
                      <button
                        type="button"
                        className="btn-ghost w-full shrink-0 justify-center border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950 sm:w-auto sm:border-0"
                        disabled={busyUnblockId === entry.id}
                        aria-label={t("blockedNumbers.unblock")}
                        onClick={() => setPendingUnblock(entry)}
                      >
                        {busyUnblockId === entry.id ? (
                          <Spinner />
                        ) : (
                          <Undo2 className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>{t("blockedNumbers.unblock")}</span>
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {total > 0 ? (
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-ink-200 px-3 py-2.5 dark:border-ink-700 sm:px-5 lg:py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden whitespace-nowrap text-xs text-ink-500 dark:text-ink-400 sm:inline">
                {t("leads.rowsPerPage")}
              </span>
              <Select
                value={String(pageSize)}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 min-w-0 py-0 ps-2 pe-8 lg:h-8 lg:!text-sm"
                wrapperClassName="w-auto flex-none"
                mobileLabel={String(pageSize)}
                aria-label={t("leads.rowsPerPage")}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </div>

            {totalPages > 1 ? (
              <nav
                aria-label={t("blockedNumbers.title")}
                className="flex shrink-0 items-center gap-1"
              >
                <button
                  type="button"
                  className="btn-ghost h-9 w-9 p-0 sm:h-8 sm:w-8"
                  disabled={currentPage === 0}
                  onClick={() => setPage(Math.max(0, currentPage - 1))}
                  aria-label={t("common.previous")}
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
                  aria-label={t("common.next")}
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

      <BlockNumberFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={block}
      />

      <ConfirmDialog
        open={pendingUnblock !== null}
        title={t("blockedNumbers.unblock")}
        body={pendingUnblock ? `+${pendingUnblock.phone}` : undefined}
        confirmLabel={t("blockedNumbers.unblock")}
        tone="primary"
        onConfirm={async () => {
          if (pendingUnblock) await unblock(pendingUnblock);
        }}
        onClose={() => setPendingUnblock(null)}
      />
    </AppShell>
  );
}
