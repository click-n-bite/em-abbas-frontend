"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Bell, BellOff, Smartphone } from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { useWebPush } from "@/hooks/use-web-push";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function PushSettingsCard() {
  const { t } = useI18n();

  const { push } = useToast();

  const {
    state,
    busy,
    error,
    // subscriptionId,
    cooldownUntil,
    enable,
    disable,
    // sendTest,
  } = useWebPush();

  const [, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (error) push(t(error), "error");
  }, [error, push, t]);

  // const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const enabled = state === "enabled";

  return (
    <section className="card p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-colors",
            enabled
              ? "bg-gradient-to-br from-emerald-500 to-emerald-700"
              : "bg-gradient-to-br from-brand-500 to-brand-700",
          )}
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">
            {t("push.title")}
          </h2>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {t("push.subtitle")}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {state === "checking" ? (
          <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
            <Spinner />
            {t("common.loading")}
          </div>
        ) : state === "unsupported" ? (
          <p className="rounded-xl bg-ink-100 px-3 py-2.5 text-xs text-ink-500 dark:bg-ink-900 dark:text-ink-400">
            {t("push.unsupported")}
          </p>
        ) : state === "backendDisabled" ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertCircle
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            {t("push.backendDisabled")}
          </p>
        ) : state === "denied" ? (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">
            <BellOff
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            {t("push.denied")}
          </p>
        ) : enabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <Bell className="h-3 w-3" aria-hidden="true" />
              {t("push.enabled")}
            </span>

            {/* <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              disabled={busy || subscriptionId === null || cooldownLeft > 0}
              onClick={() => void sendTest()}
            >
              {busy ? (
                <Spinner />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {cooldownLeft > 0
                ? t("push.testCooldown", { seconds: cooldownLeft })
                : t("push.sendTest")}
            </button> */}

            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950"
              disabled={busy}
              onClick={() => void disable()}
            >
              <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
              {t("push.disable")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary"
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
        )}
      </div>

      <p className="mt-3 text-[11px] text-ink-400">{t("push.hint")}</p>
    </section>
  );
}
