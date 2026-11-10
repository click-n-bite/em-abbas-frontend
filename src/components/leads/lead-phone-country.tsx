"use client";

import { countryName, phoneCountryOf } from "@/lib/countries";
import { CountryFlag } from "@/components/ui/country-flag";
import { useI18n } from "@/providers/i18n-provider";

export function LeadPhoneCountry({ phone }: { phone: string | null }) {
  const { locale, t } = useI18n();

  const country = phoneCountryOf(phone);

  const name = country ? countryName(country, locale) : null;

  if (!phone)
    return (
      <span className="mt-0.5 block text-xs text-ink-500">
        {t("identity.phoneUnavailable")}
      </span>
    );

  return (
    <span
      title={name ?? t("leads.phoneCountryHint")}
      className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink-500 dark:text-ink-400"
    >
      {country ? <CountryFlag code={country} className="shrink-0" /> : null}
      <bdi className="truncate">{name ?? t("leads.phoneCountryUnknown")}</bdi>
    </span>
  );
}
