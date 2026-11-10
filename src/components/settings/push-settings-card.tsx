"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Info, Laptop } from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { useWebPush } from "@/hooks/use-web-push";
import { Spinner } from "@/components/ui/spinner";
import { SettingsTile } from "@/components/settings/settings-ui";
import { cn } from "@/lib/utils";

function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;

  // iPadOS reports itself as a Mac, so check for touch as well.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Browser (web push) notifications on this device, plus the device note. */
export function PushSettingsRow() {
  const { t } = useI18n();

  const { push } = useToast();

  const { state, busy, error, enable, disable } = useWebPush();

  const [appleMobile, setAppleMobile] = useState(false);

  useEffect(() => setAppleMobile(isAppleMobile()), []);

  useEffect(() => {
    if (error) push(t(error), "error");
  }, [error, push, t]);

  const enabled = state === "enabled";

  const status =
    state === "enabled"
      ? {
          label: t("push.statusOn"),
          tone: "text-emerald-700 dark:text-emerald-300",
          dot: "bg-emerald-500",
        }
      : state === "denied"
        ? {
            label: t("push.statusBlocked"),
            tone: "text-rose-700 dark:text-rose-300",
            dot: "bg-rose-500",
          }
        : state === "prompt"
          ? {
              label: t("push.statusOff"),
              tone: "text-ink-500 dark:text-ink-400",
              dot: "bg-ink-300 dark:bg-ink-500",
            }
          : null;

  // Problems that replace the control get their own line under the description.
  const notice =
    state === "unsupported"
      ? t("push.unsupported")
      : state === "backendDisabled"
        ? t("push.backendDisabled")
        : state === "denied"
          ? t("push.denied")
          : null;

  const available = state !== "unsupported" && state !== "backendDisabled";

  return (
    <>
      <SettingsTile
        icon={<Laptop className="h-5 w-5" aria-hidden="true" />}
        label={t("push.title")}
        description={t("push.subtitle")}
        extra={
          notice ? (
            <p
              className={cn(
                "mt-1 text-xs",
                state === "denied"
                  ? "text-rose-600 dark:text-rose-300"
                  : "text-amber-700 dark:text-amber-300",
              )}
            >
              {notice}
            </p>
          ) : null
        }
      >
        {state === "checking" ? (
          <Spinner />
        ) : status ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              status.tone,
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
            {status.label}
          </span>
        ) : null}

        {enabled ? (
          <button
            type="button"
            className="btn-secondary h-10 px-4 py-0 text-sm"
            disabled={busy}
            onClick={() => void disable()}
          >
            {busy ? (
              <Spinner />
            ) : (
              <BellOff className="h-4 w-4" aria-hidden="true" />
            )}
            {t("push.disable")}
          </button>
        ) : state === "prompt" ? (
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-100 dark:hover:bg-brand-900/60"
            disabled={busy}
            onClick={() => void enable()}
          >
            {busy ? (
              <Spinner />
            ) : (
              <Bell className="h-4 w-4" aria-hidden="true" />
            )}
            {t("push.enable")}
          </button>
        ) : null}
      </SettingsTile>

      {available ? (
        <p className="flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-2 text-xs text-ink-600 dark:bg-ink-900/40 dark:text-ink-300">
          <Info
            className="mt-px h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300"
            aria-hidden="true"
          />
          <span>
            {t("push.perDevice")}
            {appleMobile ? ` ${t("push.iosHint")}` : ""}
          </span>
        </p>
      ) : null}
    </>
  );
}
