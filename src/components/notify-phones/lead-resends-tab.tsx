"use client";

import { useCallback, useState } from "react";
import { Eye, Plus, RefreshCw } from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { Spinner } from "@/components/ui/spinner";
import { parsePhone, type CountryCode } from "@/lib/countries";
import {
  leadResendsApi,
  type LeadHandlingStatus,
} from "@/lib/features/lead-resends/api";
import { useI18n } from "@/providers/i18n-provider";
import { ResendRecipient, ResendSteps } from "./resend-steps";
import { ResendBatchDetails } from "./resend-batch-details";
import { ResendError, ResendPagination, ResendStatus } from "./resend-ui";
import { useResendResource } from "./use-resend-resource";

export function LeadResendsTab({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t, formatDateTime } = useI18n();

  const [country, setCountry] = useState<CountryCode | null>("LB");

  const [national, setNational] = useState("");

  const [name, setName] = useState("");

  const [includeOpen, setIncludeOpen] = useState(true);

  const [includeInProgress, setIncludeInProgress] = useState(true);

  const [busy, setBusy] = useState(false);

  const [touched, setTouched] = useState(false);

  const [failure, setFailure] = useState<unknown>(null);

  const [page, setPage] = useState(0);

  const load = useCallback(
    (signal: AbortSignal) => leadResendsApi.list(page, signal),
    [page],
  );

  const history = useResendResource(load);

  const parsed = country ? parsePhone(national, country) : null;

  const statuses: LeadHandlingStatus[] = [
    ...(includeOpen ? (["open"] as const) : []),
    ...(includeInProgress ? (["in_progress"] as const) : []),
  ];

  const preview = async () => {
    setTouched(true);

    if (busy || !parsed?.valid || !parsed.e164 || !statuses.length) return;

    setBusy(true);
    setFailure(null);

    try {
      const batch = await leadResendsApi.preview(parsed.e164, name, statuses);

      setPage(0);
      history.refresh();
      onSelect(batch.id);
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4" data-resend-workspace>
        {selectedId ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setNational("");
                setName("");
                setTouched(false);
                setFailure(null);
                onSelect(null);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("resends.newResend")}
            </button>
          </div>
        ) : null}
        {!selectedId ? (
          <section className="card p-4 sm:p-5">
            <ResendSteps step={1} />
            <h2 className="text-base font-semibold">{t("resends.newTitle")}</h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {t("resends.description")}
            </p>

            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void preview();
              }}
            >
              <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                <PhoneInput
                  country={country}
                  national={national}
                  onCountryChange={setCountry}
                  onNationalChange={setNational}
                  label={t("resends.destination")}
                  required
                />
                <div>
                  <label className="label" htmlFor="resend-recipient-name">
                    {t("resends.recipientName")}
                  </label>
                  <input
                    id="resend-recipient-name"
                    className="input"
                    value={name}
                    maxLength={128}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="off"
                  />
                </div>
              </fieldset>
              <fieldset disabled={busy}>
                <legend className="label">{t("resends.statusLabel")}</legend>
                <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeOpen}
                      onChange={(event) => setIncludeOpen(event.target.checked)}
                    />
                    {t("resends.statusOpen")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeInProgress}
                      onChange={(event) =>
                        setIncludeInProgress(event.target.checked)
                      }
                    />
                    {t("resends.statusInProgress")}
                  </label>
                </div>
              </fieldset>
              {!statuses.length ? (
                <p
                  role="alert"
                  className="text-sm text-rose-600 dark:text-rose-300"
                >
                  {t("resends.statusRequired")}
                </p>
              ) : null}
              {touched && !parsed?.valid ? (
                <p
                  role="alert"
                  className="text-sm text-rose-600 dark:text-rose-300"
                >
                  {t("phone.invalid")}
                </p>
              ) : null}
              <ResendError error={failure} />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !statuses.length}
              >
                {busy ? (
                  <Spinner />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
                {t(busy ? "resends.previewing" : "resends.preview")}
              </button>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {t("resends.previewHint")}
              </p>
              <p className="border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-700 dark:text-ink-400">
                {t("resends.subscriptionHint")}
              </p>
            </form>
          </section>
        ) : null}

        {selectedId ? (
          <ResendBatchDetails
            key={selectedId}
            id={selectedId}
            onChanged={history.refresh}
          />
        ) : null}
      </div>

      <section
        className="card overflow-hidden"
        aria-label={t("resends.history")}
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink-100 p-4 dark:border-ink-700">
          <h2 className="font-semibold">{t("resends.history")}</h2>
          <button
            type="button"
            className="btn-ghost"
            aria-label={t("resends.refreshHistory")}
            onClick={history.refresh}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        {history.error ? (
          <div className="p-4">
            <ResendError error={history.error} onRetry={history.refresh} />
          </div>
        ) : null}
        {history.loading ? (
          <div className="p-5">
            <Spinner />
          </div>
        ) : history.data ? (
          <>
            {history.data.items.length === 0 ? (
              <p className="p-5 text-sm text-ink-500 dark:text-ink-400">
                {t("resends.emptyHistory")}
              </p>
            ) : (
              <ul className="max-h-[32rem] divide-y divide-ink-100 overflow-y-auto dark:divide-ink-700">
                {history.data.items.map((batch) => (
                  <li key={batch.id}>
                    <button
                      type="button"
                      className={`w-full space-y-2 p-4 text-start transition hover:bg-ink-50 dark:hover:bg-ink-700/40 ${selectedId === batch.id ? "bg-brand-50/60 dark:bg-brand-900/20" : ""}`}
                      aria-label={t("resends.openBatch", {
                        phone: `+${batch.recipientPhone}`,
                      })}
                      onClick={() => onSelect(batch.id)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <ResendRecipient
                          phone={batch.recipientPhone}
                          name={batch.recipientName}
                        />
                        <ResendStatus status={batch.status} />
                      </div>
                      <p className="text-xs text-ink-500 dark:text-ink-400">
                        {formatDateTime(batch.createdAt)} ·{" "}
                        {batch.status === "draft"
                          ? t("resends.previewCount", { count: batch.total })
                          : t("resends.sentCount", {
                              sent: batch.sent,
                              total: batch.total,
                            })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ResendPagination
              page={page}
              totalPages={history.data.totalPages}
              loading={history.loading}
              onPage={setPage}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
