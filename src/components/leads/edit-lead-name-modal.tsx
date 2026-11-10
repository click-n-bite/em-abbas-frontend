"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { textDirOf } from "@/lib/utils";
import { useI18n } from "@/providers/i18n-provider";

interface Props {
  /** The lead being renamed; null keeps the dialog closed. */
  lead: { id: number; customerName: string | null } | null;
  onClose: () => void;
  /** Persists the new name. Must reject on failure so the dialog stays open. */
  onSubmit: (name: string) => Promise<void>;
}

export function EditLeadNameModal({ lead, onClose, onSubmit }: Props) {
  const { t } = useI18n();

  const [name, setName] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(lead?.customerName?.trim() ?? "");
  }, [lead]);

  const trimmed = name.trim();

  const unchanged = trimmed === (lead?.customerName?.trim() ?? "");

  const submit = async () => {
    if (submitting || !trimmed || unchanged) return;

    setSubmitting(true);

    try {
      await onSubmit(trimmed);
      onClose();
    } catch {
      // The page already showed the error; keep the dialog open with what was typed.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={lead !== null}
      title={t("leads.editName")}
      description={t("leads.editNameHint")}
      onClose={submitting ? () => undefined : onClose}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void submit()}
            disabled={submitting || !trimmed || unchanged}
          >
            {submitting ? <Spinner /> : null}
            {submitting ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
            {t("leads.nameLabel")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            autoFocus
            autoComplete="off"
            dir={textDirOf(name)}
            className="input"
          />
        </label>
      </form>
    </Modal>
  );
}
