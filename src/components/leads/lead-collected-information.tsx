"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  formatCollectedValue,
  groupCollectedFields,
  SKIPPED_VALUE,
  type CollectedEntry,
  type LeadPhoto as Photo,
} from "@/lib/features/leads/collected-fields";
import { cn, textDirOf } from "@/lib/utils";
import { useI18n } from "@/providers/i18n-provider";
import { LeadPhoto } from "./lead-photo";

function fieldLabel(key: string, t: (key: string) => string): string {
  const translationKey = `leads.fields.${key}`;

  const translated = t(translationKey);

  return translated !== translationKey
    ? translated
    : key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Text and numeric answers can be corrected; photos and media paths cannot. */
function isEditable(value: unknown): boolean {
  return (
    (typeof value === "string" && !value.trim().startsWith("/media/")) ||
    typeof value === "number"
  );
}

function EditableAnswers({
  entries,
  compact = false,
  onSave,
}: {
  entries: CollectedEntry[];
  compact?: boolean;
  onSave?: (changes: Record<string, string>) => Promise<void>;
}) {
  const { t } = useI18n();

  const [editing, setEditing] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  const [emptyError, setEmptyError] = useState(false);

  const canEdit = !!onSave && entries.some(([, value]) => isEditable(value));

  const start = () => {
    setDrafts(
      Object.fromEntries(
        entries
          .filter(([, value]) => isEditable(value))
          .map(([key, value]) => [
            key,
            value === SKIPPED_VALUE ? "" : String(value),
          ]),
      ),
    );
    setEmptyError(false);
    setEditing(true);
  };

  const save = async () => {
    if (!onSave) return;

    const changes: Record<string, string> = {};

    for (const [key, value] of entries) {
      if (!(key in drafts)) continue;

      const draft = drafts[key].trim();

      const original = value === SKIPPED_VALUE ? "" : String(value);

      if (draft === original) continue;

      if (!draft) {
        // Clearing an answer is not supported; keep the original instead.
        if (original) {
          setEmptyError(true);

          return;
        }

        continue;
      }

      changes[key] = draft;
    }

    if (!Object.keys(changes).length) {
      setEditing(false);

      return;
    }

    setSaving(true);

    try {
      await onSave(changes);
      setEditing(false);
    } catch {
      // The page shows the error; keep the drafts so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {canEdit ? (
        <div className="mt-1 flex items-center justify-end gap-3">
          {editing ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              {t("leads.editDetails")}
            </button>
          )}
        </div>
      ) : null}
      {emptyError && editing ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
          {t("leads.fieldEmpty")}
        </p>
      ) : null}
      <AnswerList
        entries={entries}
        compact={compact}
        drafts={editing ? drafts : undefined}
        onDraft={(key, value) => {
          setEmptyError(false);
          setDrafts((current) => ({ ...current, [key]: value }));
        }}
      />
    </>
  );
}

function AnswerList({
  entries,
  compact = false,
  drafts,
  onDraft,
}: {
  entries: CollectedEntry[];
  compact?: boolean;
  drafts?: Record<string, string>;
  onDraft?: (key: string, value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <dl className={cn("mt-2", compact && "grid gap-x-6 sm:grid-cols-2")}>
      {entries.map(([key, value]) => {
        const skipped = value === SKIPPED_VALUE;

        const display = skipped
          ? t("leads.fieldSkipped")
          : formatCollectedValue(value);

        return (
          <div
            key={key}
            className={cn(
              "grid min-w-0 gap-1 border-b border-ink-100 py-2.5 last:border-b-0 dark:border-ink-800",
              compact
                ? "grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3"
                : "sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-x-4",
            )}
          >
            <dt className="min-w-0 text-sm leading-5 text-ink-500 [overflow-wrap:anywhere] dark:text-ink-400">
              {fieldLabel(key, t)}
            </dt>
            <dd
              className={cn(
                "min-w-0 max-w-prose whitespace-pre-wrap text-start text-sm leading-5 text-ink-900 [overflow-wrap:anywhere] dark:text-ink-100",
                compact && "font-medium",
                skipped && "italic text-ink-400 dark:text-ink-500",
              )}
            >
              {drafts && key in drafts ? (
                <textarea
                  className="input min-h-[2.5rem] w-full"
                  rows={String(drafts[key]).length > 60 ? 4 : 1}
                  maxLength={4000}
                  value={drafts[key]}
                  dir={textDirOf(drafts[key])}
                  aria-label={fieldLabel(key, t)}
                  onChange={(event) => onDraft?.(key, event.target.value)}
                />
              ) : (
                <bdi dir={textDirOf(display)}>{display}</bdi>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PhotoGallery({ photos }: { photos: Photo[] }) {
  const { t } = useI18n();

  return (
    <div className="mt-3 grid grid-cols-2 items-start gap-3 sm:grid-cols-[repeat(auto-fill,10rem)] sm:gap-4">
      {photos.map((photo, index) => (
        <LeadPhoto
          key={`${photo.fieldKey}-${index}`}
          value={photo.value}
          label={
            photo.fieldKey === "prior_contact_photos"
              ? t("leads.photoNumber", { number: index + 1 })
              : fieldLabel(photo.fieldKey, t) +
                (photo.index > 0 ? ` ${photo.index + 1}` : "")
          }
        />
      ))}
    </div>
  );
}

export function LeadCollectedInformation({
  fields,
  serviceName,
  onSave,
}: {
  fields: Record<string, unknown>;
  serviceName: string;
  /** Persists corrected answers; must reject on failure. Omit for a read-only view. */
  onSave?: (changes: Record<string, string>) => Promise<void>;
}) {
  const { t } = useI18n();

  const { personal, contact, service, servicePhotos, previousPhotos } =
    groupCollectedFields(fields);

  const sectionClass = "border-t border-ink-100 p-4 dark:border-ink-800 sm:p-5";

  const headingClass = "text-base font-semibold text-ink-900 dark:text-ink-50";

  return (
    <>
      {personal.length > 0 ? (
        <section
          className={sectionClass}
          aria-labelledby="lead-personal-information"
        >
          <h2 id="lead-personal-information" className={headingClass}>
            {t("leads.personalInformation")}
          </h2>
          <EditableAnswers entries={personal} compact onSave={onSave} />
        </section>
      ) : null}

      {service.length > 0 || servicePhotos.length > 0 ? (
        <section
          className={sectionClass}
          aria-labelledby="lead-service-details"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 id="lead-service-details" className={headingClass}>
              {t("leads.serviceDetails")}
            </h2>
            <bdi className="max-w-full rounded-md bg-ink-50 px-2 py-0.5 text-xs leading-5 text-ink-600 [overflow-wrap:anywhere] dark:bg-ink-800 dark:text-ink-300">
              {serviceName}
            </bdi>
          </div>
          {service.length > 0 ? (
            <EditableAnswers entries={service} onSave={onSave} />
          ) : null}
          {servicePhotos.length > 0 ? (
            <div className={service.length > 0 ? "mt-5" : undefined}>
              {service.length > 0 ? (
                <h3 className="text-sm font-medium text-ink-800 dark:text-ink-200">
                  {t("leads.servicePhotos")}
                </h3>
              ) : null}
              <PhotoGallery photos={servicePhotos} />
            </div>
          ) : null}
        </section>
      ) : null}

      {contact.length > 0 || previousPhotos.length > 0 ? (
        <section
          className={sectionClass}
          aria-labelledby="lead-previous-contact"
        >
          <h2 id="lead-previous-contact" className={headingClass}>
            {t("leads.previousContact")}
          </h2>
          {contact.length > 0 ? (
            <EditableAnswers entries={contact} compact onSave={onSave} />
          ) : null}
          {previousPhotos.length > 0 ? (
            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink-800 dark:text-ink-200">
                {t("leads.fields.prior_contact_photos")}
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs tabular-nums text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                  {previousPhotos.length}
                </span>
              </h3>
              <PhotoGallery photos={previousPhotos} />
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
