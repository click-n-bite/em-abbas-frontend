"use client";

import { ApiError } from "@/lib/http";
import { errorDetail, errorKey } from "@/lib/errors";
import { useI18n } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

export function ResendError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t } = useI18n();

  if (!error) return null;

  const message =
    error instanceof ApiError && error.status === 503
      ? t("resends.unavailable")
      : error instanceof ApiError && error.status === 404
        ? t("resends.notFound")
        : error instanceof ApiError && error.status === 409
          ? t("resends.conflict")
          : error instanceof ApiError && error.status === 403
            ? t("resends.forbidden")
            : (errorDetail(error) ?? t(errorKey(error)));

  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
    >
      <p className="break-words [overflow-wrap:anywhere]">{message}</p>
      {onRetry ? (
        <button type="button" className="mt-2 underline" onClick={onRetry}>
          {t("common.refresh")}
        </button>
      ) : null}
    </div>
  );
}

export function ResendStatus({
  status,
  item = false,
}: {
  status: string;
  item?: boolean;
}) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        "badge whitespace-normal",
        status === "active" || status === "queued"
          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
          : status === "completed" || status === "sent"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
            : status === "dead" || status === "completed_with_errors"
              ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200"
              : "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200",
      )}
    >
      {t(`resends.${item ? "itemStatus" : "status"}.${status}`)}
    </span>
  );
}

export function ResendPagination({
  page,
  totalPages,
  loading,
  onPage,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();

  if (totalPages < 2) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 p-4 text-sm dark:border-ink-700">
      <button
        type="button"
        className="btn-secondary"
        disabled={loading || page === 0}
        onClick={() => onPage(page - 1)}
      >
        {t("resends.previous")}
      </button>
      <span>{t("resends.page", { page: page + 1, pages: totalPages })}</span>
      <button
        type="button"
        className="btn-secondary"
        disabled={loading || page + 1 >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        {t("resends.next")}
      </button>
    </div>
  );
}
