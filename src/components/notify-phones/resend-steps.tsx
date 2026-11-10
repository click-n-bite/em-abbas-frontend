"use client";

import { useI18n } from "@/providers/i18n-provider";

export function ResendSteps({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useI18n();

  return (
    <ol className="mb-5 grid grid-cols-3 gap-2" aria-label={t("resends.steps")}>
      {(["stepDestination", "stepReview", "stepTrack"] as const).map(
        (label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className={`flex items-center gap-2 rounded-xl p-2 text-xs sm:text-sm ${step === index + 1 ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "text-ink-500 dark:text-ink-400"}`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${step >= index + 1 ? "bg-brand-600 text-white" : "bg-ink-100 dark:bg-ink-700"}`}
            >
              {index + 1}
            </span>
            {t(`resends.${label}`)}
          </li>
        ),
      )}
    </ol>
  );
}

export function ResendRecipient({
  phone,
  name,
}: {
  phone: string;
  name: string;
}) {
  const named =
    name.trim() && name.replace(/\D/g, "") !== phone.replace(/\D/g, "");

  return (
    <span className="min-w-0 break-words [overflow-wrap:anywhere]">
      {named ? <span className="block font-medium">{name}</span> : null}
      <bdi dir="ltr" className="inline-block tabular-nums">
        +{phone.replace(/^\+/, "")}
      </bdi>
    </span>
  );
}
