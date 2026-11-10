"use client";

import {
  contactIdentifier,
  contactName,
  leadNameWithCountry,
} from "@/lib/channel-identity";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { leadsApi } from "@/lib/features/leads/api";
import type { LeadService, LeadsListParams } from "@/lib/features/leads/types";
import { errorDetail, errorKey } from "@/lib/errors";
import { withReturnTo } from "@/lib/return-to";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { Select } from "@/components/ui/select";
import { SortableTh } from "@/components/ui/sortable-header";
import { LeadTableActions } from "@/components/leads/lead-table-actions";
import { LeadFormModal } from "@/components/leads/lead-form-modal";
import { LeadPhoneCountry } from "@/components/leads/lead-phone-country";
import { CloseLeadModal } from "@/components/leads/close-lead-modal";
import { EditLeadNameModal } from "@/components/leads/edit-lead-name-modal";
import { LeadExportModal } from "@/components/leads/lead-export-modal";
import { cn, textDirOf } from "@/lib/utils";
import { sameSort, toggleSort, type SortState } from "@/lib/sorting";
import type { Lead, LeadSortField, LeadSource, LeadStatus } from "@/lib/types";
import { FilterBar, FilterTabs } from "@/components/ui/filter-bar";
import { DateField } from "@/components/ui/date-field";

type StatusFilter = LeadStatus | "all";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DEFAULT_PAGE_SIZE = 25;

type LeadSort = SortState<LeadSortField>;

const DEFAULT_SORT: LeadSort = { field: "createdAt", direction: "desc" };

const SORT_MENU_FIELDS: LeadSortField[] = [
  "createdAt",
  "customerName",
  "phone",
  "status",
  "source",
  "serviceName",
  "createdBy",
  "closedBy",
  "closedAt",
  "updatedAt",
  "id",
];

const AVATAR_PALETTE = [
  "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
];

interface ListState {
  status: StatusFilter;
  source: LeadSource | "all";
  serviceId: number | "all";
  dateFrom: string;
  dateTo: string;
  mineOnly: boolean;
  search: string;
  page: number;
  pageSize: number;
  sort: LeadSort;
}

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

function readListState(
  params: { get(name: string): string | null } | null,
): ListState {
  const get = (name: string) => params?.get(name) ?? null;

  const statusParam = get("status");

  const sourceParam = get("source");

  const serviceParam = Number(get("service"));

  const fromParam = get("from");

  const toParam = get("to");

  const pageParam = parseInt(get("page") ?? "", 10);

  const sizeParam = parseInt(get("size") ?? "", 10);

  const sortParam = get("sort") as LeadSortField | null;

  const dirParam = get("dir");

  return {
    status:
      statusParam === "closed" ||
      statusParam === "in_progress" ||
      statusParam === "all"
        ? statusParam
        : "open",
    source:
      sourceParam === "ai" || sourceParam === "agent" ? sourceParam : "all",
    serviceId:
      get("service") && Number.isFinite(serviceParam) ? serviceParam : "all",
    dateFrom: fromParam && DATE_PARAM.test(fromParam) ? fromParam : "",
    dateTo: toParam && DATE_PARAM.test(toParam) ? toParam : "",
    mineOnly: get("mine") === "1",
    search: get("q") ?? "",
    page: Number.isFinite(pageParam) && pageParam >= 1 ? pageParam - 1 : 0,
    pageSize: PAGE_SIZE_OPTIONS.includes(sizeParam)
      ? sizeParam
      : DEFAULT_PAGE_SIZE,
    sort:
      sortParam &&
      SORT_MENU_FIELDS.includes(sortParam) &&
      (dirParam === "asc" || dirParam === "desc")
        ? { field: sortParam, direction: dirParam }
        : DEFAULT_SORT,
  };
}

function buildListQuery(state: ListState): string {
  const params = new URLSearchParams();

  if (state.status !== "open") params.set("status", state.status);

  if (state.source !== "all") params.set("source", state.source);

  if (state.serviceId !== "all") params.set("service", String(state.serviceId));

  if (state.dateFrom) params.set("from", state.dateFrom);

  if (state.dateTo) params.set("to", state.dateTo);

  if (state.mineOnly) params.set("mine", "1");

  if (state.search.trim()) params.set("q", state.search.trim());

  if (state.page > 0) params.set("page", String(state.page + 1));

  if (state.pageSize !== DEFAULT_PAGE_SIZE)
    params.set("size", String(state.pageSize));

  if (!sameSort(state.sort, DEFAULT_SORT)) {
    params.set("sort", state.sort.field);
    params.set("dir", state.sort.direction);
  }

  return params.toString();
}

function initialsOf(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/);

  const first = parts[0]?.[0] ?? "";

  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";

  return (first + second).toUpperCase();
}

function avatarColorOf(seed: string): string {
  let hash = 0;

  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function startOfDayIso(value: string): string | undefined {
  if (!value) return undefined;

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function endOfDayIso(value: string): string | undefined {
  if (!value) return undefined;

  const date = new Date(`${value}T23:59:59.999`);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function SourceBadge({ source }: { source: LeadSource }) {
  const { t } = useI18n();

  if (source === "ai") {
    return (
      <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        <Bot className="h-3 w-3" aria-hidden="true" />
        {t("leads.sourceLabel.ai")}
      </span>
    );
  }

  return (
    <span className="badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200">
      <UserRound className="h-3 w-3" aria-hidden="true" />
      {t("leads.sourceLabel.agent")}
    </span>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        "badge whitespace-nowrap",
        status === "open"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
          : status === "in_progress"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
            : "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200",
      )}
    >
      {t(`leads.status.${status}`)}
    </span>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsPageContent />
    </Suspense>
  );
}

function LeadsPageContent() {
  const router = useRouter();

  const searchParams = useSearchParams();

  const { t, locale, formatDateTime } = useI18n();

  const { push } = useToast();

  // Restore the list from the URL once, on mount.
  const [initial] = useState(() => readListState(searchParams));

  const [leads, setLeads] = useState<Lead[]>([]);

  const [total, setTotal] = useState(0);

  const [openCount, setOpenCount] = useState<number | null>(null);

  const [progressCount, setProgressCount] = useState<number | null>(null);

  const [closedCount, setClosedCount] = useState<number | null>(null);

  const [allCount, setAllCount] = useState<number | null>(null);

  const [page, setPage] = useState(initial.page);

  const [pageSize, setPageSize] = useState(initial.pageSize);

  const [loading, setLoading] = useState(true);

  const [failure, setFailure] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>(initial.status);

  const [source, setSource] = useState<LeadSource | "all">(initial.source);

  const [serviceId, setServiceId] = useState<number | "all">(initial.serviceId);

  const [services, setServices] = useState<LeadService[]>([]);

  const [dateFrom, setDateFrom] = useState(initial.dateFrom);

  const [dateTo, setDateTo] = useState(initial.dateTo);

  const [mineOnly, setMineOnly] = useState(initial.mineOnly);

  const [search, setSearch] = useState(initial.search);

  const [sort, setSort] = useState<LeadSort>(initial.sort);

  const lastGoodSort = useRef<LeadSort>(initial.sort);

  const loadSeq = useRef(0);

  const loadAbort = useRef<AbortController | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  const tableRef = useRef<HTMLDivElement | null>(null);

  const [formOpen, setFormOpen] = useState(false);

  const [conversationOptions, setConversationOptions] = useState<
    {
      id: string;
      label: string;
    }[]
  >([]);

  const [closingLead, setClosingLead] = useState<Lead | null>(null);

  const [renamingLead, setRenamingLead] = useState<Lead | null>(null);

  const [busyLeadId, setBusyLeadId] = useState<number | null>(null);

  const [exportFilters, setExportFilters] = useState<LeadsListParams | null>(
    null,
  );

  const closeExport = useCallback(() => setExportFilters(null), []);

  // Export and list requests share the same normalized filters and date bounds.
  const listFilters = useMemo<LeadsListParams>(
    () => ({
      status: status !== "all" ? status : undefined,
      source: source === "all" ? undefined : source,
      serviceId: serviceId === "all" ? undefined : serviceId,
      from: startOfDayIso(dateFrom),
      to: endOfDayIso(dateTo),
      mine: mineOnly || undefined,
      search: search.trim() || undefined,
      sort: sort.field,
      direction: sort.direction,
    }),
    [status, source, serviceId, dateFrom, dateTo, mineOnly, search, sort],
  );

  // The current list as a URL. This is what detail and conversation pages
  // receive as returnTo, and what is kept in the address bar.
  const listQuery = buildListQuery({
    status,
    source,
    serviceId,
    dateFrom,
    dateTo,
    mineOnly,
    search,
    page,
    pageSize,
    sort,
  });

  const listUrl = listQuery ? `/leads?${listQuery}` : "/leads";

  // True when any filter, the search box or the sort differs from the default.
  const hasActiveFilters =
    search.trim() !== "" ||
    source !== "all" ||
    serviceId !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    mineOnly ||
    status !== "open" ||
    !sameSort(sort, DEFAULT_SORT);

  // Count only the fields inside the filter panel.
  const moreFiltersCount = [
    source !== "all",
    serviceId !== "all",
    dateFrom !== "",
    dateTo !== "",
    mineOnly,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearch("");
    setSource("all");
    setServiceId("all");
    setDateFrom("");
    setDateTo("");
    setMineOnly(false);
    setStatus("open");
    setSort(DEFAULT_SORT);
    setPage(0);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((searchParams?.toString() ?? "") !== listQuery) {
        router.replace(listUrl, { scroll: false });
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [listQuery, listUrl, router, searchParams]);

  // Back to the top of the list when the page changes.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    tableRef.current?.scrollTo({ top: 0 });
  }, [page, pageSize]);

  const openLead = (lead: Lead) =>
    router.push(withReturnTo(`/leads/${lead.id}`, listUrl));

  const openChat = (lead: Lead) => {
    const params = new URLSearchParams({
      id: lead.conversationId,
      leadsReturnTo: listUrl,
    });

    router.push(`/conversations?${params.toString()}`);
  };

  useEffect(() => {
    const controller = new AbortController();

    leadsApi
      .services(controller.signal)
      .then(setServices)
      .catch(() => setServices([]));

    return () => controller.abort();
  }, []);

  const load = useCallback(
    async (silent = false) => {
      const seq = ++loadSeq.current;

      loadAbort.current?.abort();

      const controller = new AbortController();

      loadAbort.current = controller;

      if (!silent) setLoading(true);

      try {
        const result = await leadsApi.list(
          {
            ...listFilters,
            page,
            size: pageSize,
          },
          controller.signal,
        );

        if (seq !== loadSeq.current) return;

        setLeads(result.items);
        setTotal(result.total);
        setFailure(null);
        lastGoodSort.current = sort;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;

        if (seq !== loadSeq.current) return;

        if (!sameSort(sort, lastGoodSort.current)) {
          setSort(lastGoodSort.current);
          push(errorDetail(error) ?? t("sorting.failed"), "error");

          return;
        }

        setFailure(errorKey(error));
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [listFilters, page, pageSize, sort, push, t],
  );

  const changeSort = (next: LeadSort) => {
    setSort(next);
    setPage(0);
  };

  const onHeaderSort = (field: LeadSortField) =>
    changeSort(toggleSort(sort, field));

  const byField: LeadSortField | null =
    status === "open" ? "createdBy" : status === "closed" ? "closedBy" : null;

  const loadCounts = useCallback(async () => {
    const shared = {
      source: source === "all" ? undefined : source,
      serviceId: serviceId === "all" ? undefined : serviceId,
      from: startOfDayIso(dateFrom),
      to: endOfDayIso(dateTo),
      mine: mineOnly || undefined,
      search: search.trim() || undefined,
      page: 0,
      size: 1,
    };

    try {
      const [openRes, progressRes, closedRes, allRes] = await Promise.all([
        leadsApi.list({ ...shared, status: "open" }),
        leadsApi.list({ ...shared, status: "in_progress" }),
        leadsApi.list({ ...shared, status: "closed" }),
        leadsApi.list(shared),
      ]);

      setOpenCount(openRes.total);
      setProgressCount(progressRes.total);
      setClosedCount(closedRes.total);
      setAllCount(allRes.total);
    } catch {
      // Non-critical — tabs fall back to no count badge
    }
  }, [source, serviceId, dateFrom, dateTo, mineOnly, search]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    source,
    serviceId,
    dateFrom,
    dateTo,
    mineOnly,
    page,
    pageSize,
    sort,
  ]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts, status]);

  const previousSearch = useRef(search);

  useEffect(() => {
    if (previousSearch.current === search) return;

    previousSearch.current = search;
    setPage(0);

    const timer = window.setTimeout(() => void load(true), 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openAddModal = () => {
    api
      .conversations("all")
      .then((list) =>
        setConversationOptions(
          list
            .filter((conversation) => !conversation.hidden)
            .map((conversation) => ({
              id: conversation.id,
              label: contactName(conversation),
            })),
        ),
      )
      .catch(() => setConversationOptions([]));

    setFormOpen(true);
  };

  const submitLead = async (payload: {
    conversationId: string;
    serviceId: number;
    note?: string;
  }) => {
    try {
      await api.createLead(payload);

      push(t("leads.added"), "success");
      setFormOpen(false);
      void load(true);
      void loadCounts();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        push(t("leads.duplicate"), "error");
      } else {
        push(errorDetail(error) ?? t(errorKey(error)), "error");
      }

      throw error;
    }
  };

  const closeLead = async (closeNote: string) => {
    if (!closingLead) return;

    setBusyLeadId(closingLead.id);

    try {
      await leadsApi.update(closingLead.id, {
        status: "closed",
        closeNote,
      });

      push(t("leads.closed"), "success");
      void load(true);
      void loadCounts();
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setBusyLeadId(null);
      setClosingLead(null);
    }
  };

  const renameLead = async (name: string) => {
    if (!renamingLead) return;

    try {
      await leadsApi.update(renamingLead.id, { customerName: name });
      push(t("leads.nameSaved"), "success");
      void load(true);
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
      throw error;
    }
  };

  const changeHandling = async (lead: Lead) => {
    setBusyLeadId(lead.id);

    try {
      await leadsApi.update(lead.id, {
        status: lead.status === "open" ? "in_progress" : "open",
      });
      push(t("leads.statusUpdated"), "success");
      void load(true);
      void loadCounts();
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setBusyLeadId(null);
    }
  };

  const reopenLead = async (lead: Lead) => {
    setBusyLeadId(lead.id);

    try {
      await leadsApi.update(lead.id, { status: "open" });

      push(t("leads.reopened"), "success");
      void load(true);
      void loadCounts();
    } catch (error) {
      push(errorDetail(error) ?? t(errorKey(error)), "error");
    } finally {
      setBusyLeadId(null);
    }
  };

  const selectedServiceName =
    serviceId === "all"
      ? t("leads.serviceAll")
      : (services.find((service) => service.id === serviceId)?.name ??
        t("leads.serviceAll"));

  const formatDateOnly = (value: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
      dateStyle: "medium",
    }).format(new Date(`${value}T00:00:00`));

  const dateFromLabel = dateFrom
    ? formatDateOnly(dateFrom)
    : t("leads.dateFrom");

  const dateToLabel = dateTo ? formatDateOnly(dateTo) : t("leads.dateTo");

  return (
    <AppShell
      title={t("leads.title")}
      subtitle={failure ? t(failure) : t("leads.subtitle")}
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
            className="btn-secondary"
            onClick={() => setExportFilters(listFilters)}
            aria-label={t("leads.exportExcel")}
            title={t("leads.exportExcel")}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("leads.exportExcel")}</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={openAddModal}
            aria-label={t("leads.add")}
            title={t("leads.add")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("leads.add")}</span>
          </button>
        </div>
      }
    >
      <section className="card flex h-[calc(100dvh-8.5rem)] min-h-[28rem] flex-col overflow-hidden lg:h-full lg:min-h-[24rem]">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("leads.searchPlaceholder")}
          searchLabel={t("common.search")}
          filtersLabel={t("leads.moreFilters")}
          activeCount={moreFiltersCount}
          hasActive={hasActiveFilters}
          clearLabel={t("leads.clearFilters")}
          onClear={clearAllFilters}
          tabs={
            <FilterTabs<StatusFilter>
              label={t("leads.title")}
              value={status}
              options={[
                {
                  value: "open",
                  label: t("leads.filters.open"),
                  count: openCount,
                },
                {
                  value: "in_progress",
                  label: t("leads.filters.in_progress"),
                  count: progressCount,
                },
                {
                  value: "closed",
                  label: t("leads.filters.closed"),
                  count: closedCount,
                },
                {
                  value: "all",
                  label: t("leads.filters.all"),
                  count: allCount,
                },
              ]}
              onChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
            />
          }
        >
          <Select
            value={source}
            onChange={(event) => {
              setSource(event.target.value as LeadSource | "all");
              setPage(0);
            }}
            className="h-11 min-w-0 ps-2 pe-8 lg:h-10 lg:ps-3 lg:pe-10"
            wrapperClassName="min-w-0 lg:min-w-[9rem] lg:flex-1"
            mobileLabel={t(`leads.source.${source}`)}
            aria-label={t("leads.colSource")}
          >
            <option value="all">{t("leads.source.all")}</option>
            <option value="ai">{t("leads.source.ai")}</option>
            <option value="agent">{t("leads.source.agent")}</option>
          </Select>

          <Select
            value={String(serviceId)}
            onChange={(event) => {
              setServiceId(
                event.target.value === "all"
                  ? "all"
                  : Number(event.target.value),
              );
              setPage(0);
            }}
            className="h-11 min-w-0 ps-2 pe-8 lg:h-10 lg:ps-3 lg:pe-10"
            wrapperClassName="min-w-0 lg:min-w-[11rem] lg:flex-[1.5]"
            mobileLabel={selectedServiceName}
            aria-label={t("leads.service")}
          >
            <option value="all">{t("leads.serviceAll")}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>

          <DateField
            value={dateFrom}
            max={dateTo || undefined}
            display={dateFromLabel}
            label={t("leads.dateFrom")}
            onChange={(next) => {
              setDateFrom(next);
              setPage(0);
            }}
          />

          <DateField
            value={dateTo}
            min={dateFrom || undefined}
            display={dateToLabel}
            label={t("leads.dateTo")}
            onChange={(next) => {
              setDateTo(next);
              setPage(0);
            }}
          />

          <label className="col-span-2 flex min-h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 lg:col-span-1 lg:min-h-10 lg:whitespace-nowrap lg:text-xs">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(event) => {
                setMineOnly(event.target.checked);
                setPage(0);
              }}
              className="h-4 w-4 shrink-0"
            />
            <span className="min-w-0">{t("leads.mineOnly")}</span>
          </label>
        </FilterBar>

        <div
          ref={listRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden"
        >
          {loading && leads.length === 0 ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <EmptyState
              icon={<UserRoundPlus className="h-5 w-5" aria-hidden="true" />}
              title={t("leads.empty")}
            />
          ) : (
            <>
              <ul
                aria-label={t("leads.listTitle")}
                className="space-y-3 bg-ink-50/50 p-3 dark:bg-ink-900/20 lg:hidden"
              >
                {leads.map((lead) => {
                  const displayName = contactName(lead);

                  return (
                    <li
                      key={lead.id}
                      className="rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-800"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            avatarColorOf(displayName),
                          )}
                        >
                          {initialsOf(displayName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="min-w-0 break-words text-sm font-semibold leading-5 text-ink-900 dark:text-ink-50">
                              <bdi
                                dir={
                                  lead.customerName?.trim()
                                    ? textDirOf(displayName)
                                    : "ltr"
                                }
                              >
                                {leadNameWithCountry(lead)}
                              </bdi>
                              <button
                                type="button"
                                onClick={() => setRenamingLead(lead)}
                                className="btn-ghost ms-1 inline-flex h-6 w-6 shrink-0 items-center justify-center p-0 align-middle"
                                aria-label={t("leads.editName")}
                                title={t("leads.editName")}
                              >
                                <Pencil
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </h2>
                            <span className="shrink-0">
                              <StatusBadge status={lead.status} />
                            </span>
                          </div>
                          {lead.customerName?.trim() ? (
                            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                              <bdi dir="ltr">{contactIdentifier(lead)}</bdi>
                            </p>
                          ) : null}
                          <LeadPhoneCountry phone={lead.phone} />
                        </div>
                      </div>

                      <dl className="mt-3">
                        <dt className="text-xs font-medium text-ink-500 dark:text-ink-400">
                          {t("leads.service")}
                        </dt>
                        <dd className="mt-0.5 break-words text-sm leading-5 text-ink-800 dark:text-ink-100">
                          <bdi dir={textDirOf(lead.serviceName)}>
                            {lead.serviceName}
                          </bdi>
                        </dd>
                      </dl>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <SourceBadge source={lead.source} />
                        <time
                          dateTime={lead.createdAt}
                          title={`${t("leads.createdAt")}: ${formatDateTime(lead.createdAt)}`}
                          aria-label={`${t("leads.createdAt")}: ${formatDateTime(lead.createdAt)}`}
                          className="text-xs text-ink-500 dark:text-ink-400"
                        >
                          {formatDateTime(lead.createdAt)}
                        </time>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-ink-100 pt-2 dark:border-ink-700">
                        {lead.status !== "closed" && (
                          <button
                            type="button"
                            className="btn-secondary col-span-2 px-2 py-1.5 text-xs"
                            disabled={busyLeadId === lead.id}
                            onClick={() => void changeHandling(lead)}
                          >
                            {t(
                              lead.status === "open"
                                ? "leads.startProgress"
                                : "leads.returnToOpen",
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-primary min-h-9 min-w-0 px-2 py-1.5 text-xs"
                          onClick={() => openLead(lead)}
                        >
                          {t("leads.viewDetails")}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary min-h-9 min-w-0 px-2 py-1.5 text-xs"
                          onClick={() => openChat(lead)}
                        >
                          {t("leads.viewChat")}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost col-span-2 min-h-8 justify-self-end px-2 py-1 text-xs"
                          disabled={busyLeadId === lead.id}
                          onClick={() =>
                            lead.status !== "closed"
                              ? setClosingLead(lead)
                              : void reopenLead(lead)
                          }
                        >
                          {busyLeadId === lead.id ? <Spinner /> : null}
                          {lead.status !== "closed"
                            ? t("leads.confirmClose")
                            : t("leads.reopen")}
                        </button>
                      </div>
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
                      <SortableTh
                        field="customerName"
                        label={t("leads.colName")}
                        sort={sort}
                        onSort={onHeaderSort}
                        className="px-5 py-2.5 text-center"
                      />
                      <SortableTh
                        field="serviceName"
                        label={t("leads.service")}
                        sort={sort}
                        onSort={onHeaderSort}
                        className="px-3 py-2.5 text-center"
                      />
                      <SortableTh
                        field="source"
                        label={t("leads.colSource")}
                        sort={sort}
                        onSort={onHeaderSort}
                        className="px-3 py-2.5 text-center"
                      />
                      <SortableTh
                        field="status"
                        label={t("leads.colStatus")}
                        sort={sort}
                        onSort={onHeaderSort}
                        className="px-3 py-2.5 text-center"
                      />
                      <SortableTh
                        field="createdAt"
                        label={t("leads.createdAt")}
                        sort={sort}
                        onSort={onHeaderSort}
                        className="px-3 py-2.5 text-center"
                      />
                      <th className="px-3 py-2.5 text-center">
                        {t("leads.lastActivity")}
                      </th>
                      {byField ? (
                        <SortableTh
                          field={byField}
                          label={t("leads.by")}
                          sort={sort}
                          onSort={onHeaderSort}
                          className="px-3 py-2.5 text-center"
                        />
                      ) : (
                        <th className="px-3 py-2.5 text-center">
                          {t("leads.by")}
                        </th>
                      )}
                      <th className="px-5 py-2.5 text-center">
                        {t("leads.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-700/70">
                    {leads.map((lead) => {
                      const displayName = contactName(lead);

                      const lastActivityAt =
                        lead.status === "closed" && lead.closedAt
                          ? lead.closedAt
                          : lead.createdAt;

                      const attributedTo =
                        lead.status === "closed"
                          ? (lead.closedBy?.displayName ?? t("common.unknown"))
                          : (lead.createdBy?.displayName ??
                            t("leads.sourceLabel.ai"));

                      return (
                        <tr
                          key={lead.id}
                          className="align-middle transition hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                  avatarColorOf(displayName),
                                )}
                              >
                                {initialsOf(displayName)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <p
                                    dir={textDirOf(displayName)}
                                    className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50"
                                  >
                                    {leadNameWithCountry(lead)}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setRenamingLead(lead)}
                                    className="btn-ghost inline-flex h-6 w-6 shrink-0 items-center justify-center p-0"
                                    aria-label={t("leads.editName")}
                                    title={t("leads.editName")}
                                  >
                                    <Pencil
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                                <p
                                  dir="ltr"
                                  className="text-xs text-ink-500 dark:text-ink-400"
                                >
                                  {contactIdentifier(lead)}
                                </p>
                                <LeadPhoneCountry phone={lead.phone} />
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <p
                              dir={textDirOf(lead.serviceName)}
                              className="max-w-[10rem] text-sm text-ink-800 dark:text-ink-100"
                            >
                              {lead.serviceName}
                            </p>
                          </td>

                          <td className="px-3 py-3">
                            <SourceBadge source={lead.source} />
                          </td>

                          <td className="px-3 py-3">
                            <StatusBadge status={lead.status} />
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-500 dark:text-ink-400">
                            <time
                              dateTime={lead.createdAt}
                              title={formatDateTime(lead.createdAt)}
                            >
                              <span className="block text-ink-700 dark:text-ink-200">
                                {new Intl.DateTimeFormat(
                                  locale === "ar" ? "ar" : "en-GB",
                                  { dateStyle: "medium" },
                                ).format(new Date(lead.createdAt))}
                              </span>
                              <span className="mt-0.5 block text-[11px]">
                                {new Intl.DateTimeFormat(
                                  locale === "ar" ? "ar" : "en-GB",
                                  { timeStyle: "short" },
                                ).format(new Date(lead.createdAt))}
                              </span>
                            </time>
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-500 dark:text-ink-400">
                            <time
                              dateTime={lastActivityAt}
                              title={formatDateTime(lastActivityAt)}
                            >
                              <span className="block text-ink-700 dark:text-ink-200">
                                {new Intl.DateTimeFormat(
                                  locale === "ar" ? "ar" : "en-GB",
                                  { dateStyle: "medium" },
                                ).format(new Date(lastActivityAt))}
                              </span>
                              <span className="mt-0.5 block text-[11px]">
                                {new Intl.DateTimeFormat(
                                  locale === "ar" ? "ar" : "en-GB",
                                  { timeStyle: "short" },
                                ).format(new Date(lastActivityAt))}
                              </span>
                            </time>
                          </td>

                          <td className="max-w-[8rem] truncate px-3 py-3 text-xs text-ink-500 dark:text-ink-400">
                            {attributedTo}
                          </td>

                          <td className="w-px whitespace-nowrap px-4 py-3">
                            <LeadTableActions
                              status={lead.status}
                              busy={busyLeadId === lead.id}
                              onDetails={() => openLead(lead)}
                              onChat={() => openChat(lead)}
                              onChangeHandling={() => void changeHandling(lead)}
                              onClose={() => setClosingLead(lead)}
                              onReopen={() => void reopenLead(lead)}
                            />
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
          <PaginationFooter
            page={page}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            total={total}
            ariaLabel={t("leads.title")}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
          />
        ) : null}
      </section>

      <LeadFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={submitLead}
        conversationOptions={conversationOptions}
      />

      {exportFilters !== null ? (
        <LeadExportModal filters={exportFilters} onClose={closeExport} />
      ) : null}

      <CloseLeadModal
        lead={closingLead}
        onClose={() => setClosingLead(null)}
        onSubmit={closeLead}
      />

      <EditLeadNameModal
        lead={renamingLead}
        onClose={() => setRenamingLead(null)}
        onSubmit={renameLead}
      />
    </AppShell>
  );
}
