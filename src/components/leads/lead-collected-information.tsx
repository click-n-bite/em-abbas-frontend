"use client";

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

function AnswerList({
  entries,
  compact = false,
}: {
  entries: CollectedEntry[];
  compact?: boolean;
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
              <bdi dir={textDirOf(display)}>{display}</bdi>
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
}: {
  fields: Record<string, unknown>;
  serviceName: string;
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
          <AnswerList entries={personal} compact />
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
          {service.length > 0 ? <AnswerList entries={service} /> : null}
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
          {contact.length > 0 ? <AnswerList entries={contact} compact /> : null}
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
