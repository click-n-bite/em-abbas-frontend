"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Send, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  leadResendsApi,
  type ItemStatus,
} from "@/lib/features/lead-resends/api";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { ResendRecipient, ResendSteps } from "./resend-steps";
import { ResendError, ResendPagination, ResendStatus } from "./resend-ui";
import { useResendResource } from "./use-resend-resource";

type Action = "start" | "retry" | "cancel";

export function ResendBatchDetails({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const { t, formatDateTime } = useI18n();

  const { push } = useToast();

  const load = useCallback(
    (signal: AbortSignal) => leadResendsApi.get(id, signal),
    [id],
  );

  const resource = useResendResource(load);

  const batch = resource.data;

  const panel = useRef<HTMLElement | null>(null);

  const hasBatch = Boolean(batch);

  const [confirm, setConfirm] = useState<Action | null>(null);

  const [busy, setBusy] = useState(false);

  const busyRef = useRef(false);

  const [actionError, setActionError] = useState<unknown>(null);

  const [revision, setRevision] = useState(0);

  const closeConfirm = useCallback(() => {
    if (!busyRef.current) setConfirm(null);
  }, []);

  const expired =
    batch?.status === "expired" ||
    Boolean(
      batch &&
        Date.parse(batch.expiresAt) <= Date.now() &&
        batch.status === "draft",
    );

  const canStart = Boolean(
    batch && batch.status === "draft" && batch.total > 0 && !expired,
  );

  const canRetry = Boolean(
    batch &&
      batch.startedAt &&
      batch.status !== "cancelled" &&
      batch.failed > 0,
  );

  const canCancel = batch?.status === "draft" || batch?.status === "active";

  useEffect(() => {
    if (hasBatch) {
      panel.current?.focus({ preventScroll: true });
      panel.current
        ?.closest("[data-resend-workspace]")
        ?.scrollIntoView({ block: "start" });
    }
  }, [id, hasBatch]);

  useEffect(() => {
    if (confirm === "start" && batch && batch.status !== "draft" && !busy) {
      setConfirm(null);
      setActionError(null);
    }
  }, [batch, confirm, busy]);

  const run = async () => {
    if (!batch || !confirm || busyRef.current) return;

    if (
      (confirm === "start" && !canStart) ||
      (confirm === "retry" && !canRetry) ||
      (confirm === "cancel" && !canCancel)
    )
      return;

    busyRef.current = true;
    setBusy(true);
    setActionError(null);

    try {
      // On an uncertain response, keep this batch ID. Never create a fresh preview automatically.
      const updated = await leadResendsApi[confirm](id);

      resource.replace(updated);
      onChanged();
      setRevision((value) => value + 1);
      setConfirm(null);
      push(t(`resends.${confirm}Success`), "success");
    } catch (error) {
      setActionError(error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (!batch)
    return (
      <section className="card p-5" aria-label={t("resends.details")}>
        {resource.loading ? (
          <Spinner />
        ) : (
          <ResendError error={resource.error} onRetry={resource.refresh} />
        )}
      </section>
    );

  const waiting = batch.pending + batch.sending + batch.retrying;

  const stats = [
    { label: "total", value: batch.total },
    { label: "sent", value: batch.sent },
    { label: "waiting", value: waiting },
    { label: "failed", value: batch.failed },
  ];

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="card overflow-hidden"
      aria-label={t("resends.details")}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <ResendSteps step={batch.startedAt ? 3 : 2} />
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {t("resends.recipientLabel")}
            </p>
            <div className="mt-1 text-lg">
              <ResendRecipient
                phone={batch.recipientPhone}
                name={batch.recipientName}
              />
            </div>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              {formatDateTime(batch.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ResendStatus
              status={
                expired && batch.status === "draft" ? "expired" : batch.status
              }
            />
            <button
              type="button"
              className="btn-ghost"
              aria-label={t("resends.refreshBatch")}
              onClick={resource.refresh}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>
        <ResendError error={resource.error} onRetry={resource.refresh} />
        {!confirm ? <ResendError error={actionError} /> : null}
        <div className="rounded-xl border border-ink-100 bg-ink-50 p-4 dark:border-ink-700 dark:bg-ink-900/30">
          <h2 className="text-xl font-semibold">
            {t(
              `resends.overview.${expired && batch.status === "draft" ? "expired" : batch.status}`,
            )}
          </h2>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
            {expired
              ? t("resends.expiredHint")
              : batch.status === "draft"
                ? batch.total === 0
                  ? t("resends.emptyPreview")
                  : t("resends.review", {
                      count: batch.total,
                      phone: `\u2066+${batch.recipientPhone}\u2069`,
                    })
                : batch.status === "cancelled"
                  ? t("resends.cancelledSummary", {
                      sent: batch.sent,
                      count: batch.cancelled,
                    })
                  : t("resends.sentCount", {
                      sent: batch.sent,
                      total: batch.total,
                    })}
          </p>
          {batch.status === "draft" && !expired && batch.total > 0 ? (
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
              {t("resends.expires", { date: formatDateTime(batch.expiresAt) })}
            </p>
          ) : null}
        </div>
        {batch.startedAt ? (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-ink-100 p-3 dark:border-ink-700"
                >
                  <dt className="text-xs text-ink-500 dark:text-ink-400">
                    {t(`resends.count.${label}`)}
                  </dt>
                  <dd
                    className={`mt-1 text-2xl font-semibold tabular-nums ${label === "failed" && value > 0 ? "text-rose-600 dark:text-rose-300" : ""}`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div
              role="progressbar"
              aria-label={t("resends.progress")}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, batch.total)}
              aria-valuenow={batch.sent}
              className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-700"
            >
              <div
                className="h-full rounded-full bg-brand-600 transition-[width]"
                style={{
                  width: `${batch.total ? Math.min(100, (batch.sent / batch.total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {t("resends.sentHint")}
            </p>
            {batch.skipped > 0 ||
            batch.cancelled > 0 ||
            batch.sending > 0 ||
            batch.retrying > 0 ? (
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
                {(["sending", "retrying", "skipped", "cancelled"] as const)
                  .filter((key) => batch[key] > 0)
                  .map((key) => (
                    <span key={key}>
                      {batch[key]} {t(`resends.count.${key}`)}
                    </span>
                  ))}
              </p>
            ) : null}
          </>
        ) : null}
        {batch.status === "active" ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {t("resends.backgroundHint")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {batch.status === "draft" ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!canStart || busy}
              onClick={() => {
                setActionError(null);
                setConfirm("start");
              }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("resends.send")}
            </button>
          ) : null}
          {canRetry ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setActionError(null);
                setConfirm("retry");
              }}
            >
              {t("resends.retryFailed")}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="btn-secondary text-rose-600 dark:text-rose-300"
              disabled={busy}
              onClick={() => {
                setActionError(null);
                setConfirm("cancel");
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t("resends.cancelBatch")}
            </button>
          ) : null}
        </div>
      </div>

      <ResendItems key={`${id}-${revision}`} id={id} />

      <Modal
        open={confirm !== null}
        title={t(`resends.${confirm ?? "start"}Title`)}
        onClose={closeConfirm}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={closeConfirm}
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              className={confirm === "cancel" ? "btn-danger" : "btn-primary"}
              disabled={
                busy ||
                (confirm === "start" && !canStart) ||
                (confirm === "retry" && !canRetry) ||
                (confirm === "cancel" && !canCancel)
              }
              onClick={() => void run()}
            >
              {busy ? <Spinner /> : null}
              {t(
                busy
                  ? "resends.working"
                  : `resends.${confirm ?? "start"}Confirm`,
              )}
            </button>
          </>
        }
      >
        <p className="text-sm">
          {t(`resends.${confirm ?? "start"}Body`, {
            count: confirm === "retry" ? batch.failed : batch.total,
            phone: `\u2066+${batch.recipientPhone}\u2069`,
          })}
        </p>
        {confirm === "start" ? (
          <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
            {t("resends.subscriptionHint")}
          </p>
        ) : null}
        <div className="mt-3">
          <ResendError error={actionError} />
        </div>
      </Modal>
    </section>
  );
}

function ResendItems({ id }: { id: string }) {
  const { t, formatDateTime } = useI18n();

  const [page, setPage] = useState(0);

  const [status, setStatus] = useState<ItemStatus | "all">("all");

  const load = useCallback(
    (signal: AbortSignal) => leadResendsApi.items(id, page, status, signal),
    [id, page, status],
  );

  const resource = useResendResource(load);

  const statuses: (ItemStatus | "all")[] = [
    "all",
    "pending",
    "queued",
    "failed_retryable",
    "sent",
    "dead",
    "skipped",
    "cancelled",
  ];

  return (
    <div className="border-t border-ink-100 dark:border-ink-700">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h3 className="text-sm font-semibold">{t("resends.items")}</h3>
        <label className="flex items-center gap-2 text-xs">
          <span>{t("resends.filter")}</span>
          <select
            aria-label={t("resends.filter")}
            className="input w-auto max-w-full"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ItemStatus | "all");
              setPage(0);
            }}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {t(`resends.itemStatus.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {resource.error ? (
        <div className="px-4 pb-4">
          <ResendError error={resource.error} onRetry={resource.refresh} />
        </div>
      ) : null}
      {resource.loading ? (
        <div className="p-4">
          <Spinner />
        </div>
      ) : resource.data ? (
        <>
          {resource.data.items.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-500 dark:text-ink-400">
              {t("resends.emptyItems")}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-700">
              {resource.data.items.map((item) => (
                <li key={item.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/leads/${item.leadId}`}
                      className="text-sm font-medium text-brand-600 underline dark:text-brand-300"
                    >
                      {t("resends.viewLead", { id: item.leadId })}
                    </Link>
                    <ResendStatus status={item.status} item />
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    {t("resends.attempts", { count: item.attempts })}
                    {item.nextAttemptAt && item.status === "failed_retryable"
                      ? ` · ${t("resends.nextRetry", { date: formatDateTime(item.nextAttemptAt) })}`
                      : ""}
                    {item.sentAt ? ` · ${formatDateTime(item.sentAt)}` : ""}
                  </p>
                  {item.lastError ? (
                    <details className="text-xs text-ink-500 dark:text-ink-400">
                      <summary className="cursor-pointer">
                        {t("resends.reason")}
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {item.lastError}
                      </p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <ResendPagination
            page={page}
            totalPages={resource.data.totalPages}
            loading={resource.loading}
            onPage={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
