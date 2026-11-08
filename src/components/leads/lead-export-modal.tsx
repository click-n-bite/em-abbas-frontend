"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { errorDetail, errorKey } from "@/lib/errors";
import { leadsApi } from "@/lib/features/leads/api";
import type {
  LeadExportScope,
  LeadsListParams,
} from "@/lib/features/leads/types";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";

interface Props {
  filters: LeadsListParams;
  onClose: () => void;
}

export function LeadExportModal({ filters, onClose }: Props) {
  const { t, locale } = useI18n();

  const { push } = useToast();

  const [scope, setScope] = useState<LeadExportScope>("filtered");

  const [busy, setBusy] = useState(false);

  const [failure, setFailure] = useState<string | null>(null);

  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const download = async () => {
    if (pending.current) return;

    const controller = new AbortController();

    pending.current = controller;
    setBusy(true);
    setFailure(null);

    try {
      const file = await leadsApi.export(
        { ...filters, scope, language: locale },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(file.blob);

      const anchor = document.createElement("a");

      try {
        anchor.href = url;
        anchor.download = file.filename;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      push(t("leads.exportStarted"), "success");
      onClose();
    } catch (error) {
      if (controller.signal.aborted) return;

      const key = errorKey(error);

      setFailure(
        errorDetail(error) ??
          (key === "errors.generic" ? t("leads.exportFailed") : t(key)),
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);

      pending.current = null;
    }
  };

  return (
    <Modal
      open
      title={t("leads.exportExcel")}
      description={t("leads.exportDescription")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void download()}
            disabled={busy}
          >
            {busy ? (
              <Spinner />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? t("leads.exportPreparing") : t("leads.exportDownload")}
          </button>
        </>
      }
    >
      <fieldset disabled={busy} className="space-y-3">
        <legend className="sr-only">{t("leads.exportScope")}</legend>
        {(["filtered", "all"] as const).map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 p-3 focus-within:ring-2 focus-within:ring-brand-500 dark:border-ink-600"
          >
            <input
              type="radio"
              name="lead-export-scope"
              value={value}
              checked={scope === value}
              onChange={() => setScope(value)}
              className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-900 dark:text-ink-50">
                {t(
                  value === "filtered"
                    ? "leads.exportFiltered"
                    : "leads.exportAll",
                )}
              </span>
              <span className="mt-1 block text-xs leading-5 text-ink-500 dark:text-ink-400">
                {t(
                  value === "filtered"
                    ? "leads.exportFilteredHint"
                    : "leads.exportAllHint",
                )}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
        {t("leads.exportLanguage")}
      </p>
      {busy ? (
        <p
          role="status"
          className="mt-3 text-sm text-ink-600 dark:text-ink-300"
        >
          {t("leads.exportWait")}
        </p>
      ) : null}
      {failure ? (
        <p
          role="alert"
          className="mt-3 text-sm text-rose-600 dark:text-rose-300"
        >
          {failure}
        </p>
      ) : null}
    </Modal>
  );
}
