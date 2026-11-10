"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { NotificationNumbersTab } from "@/components/notify-phones/notification-numbers-tab";
import { LeadResendsTab } from "@/components/notify-phones/lead-resends-tab";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

export default function LeadNotificationsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LeadNotificationsContent />
    </Suspense>
  );
}

function LeadNotificationsContent() {
  const { ready, token, canManageUsers } = useAuth();

  const { t } = useI18n();

  const router = useRouter();

  const params = useSearchParams();

  const tab = params.get("tab") === "resend" ? "resend" : "numbers";

  const selectedId = params.get("batch");

  const navigate = (next: "numbers" | "resend", batch?: string) => {
    const query = new URLSearchParams();

    if (next === "resend") query.set("tab", "resend");

    if (next === "resend" && batch) query.set("batch", batch);

    router.replace(`/notify-phones${query.size ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  return (
    <AppShell
      title={t("notifyPhones.title")}
      subtitle={t("notifyPhones.managementSubtitle")}
    >
      {!ready ? (
        <Spinner />
      ) : !token || !canManageUsers ? (
        <section className="card">
          <EmptyState
            icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
            title={t("resends.forbidden")}
          />
        </section>
      ) : (
        <div className="space-y-5">
          <div
            role="tablist"
            aria-label={t("notifyPhones.title")}
            className="flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-800"
          >
            {(["numbers", "resend"] as const).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                id={`notifications-tab-${name}`}
                aria-controls={`notifications-panel-${name}`}
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => navigate(name)}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;

                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "numbers"
                      : event.key === "End"
                        ? "resend"
                        : tab === "numbers"
                          ? "resend"
                          : "numbers";

                  navigate(next);
                  requestAnimationFrame(() =>
                    document
                      .getElementById(`notifications-tab-${next}`)
                      ?.focus(),
                  );
                }}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  tab === name
                    ? "bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-brand-200"
                    : "text-ink-600 dark:text-ink-300",
                )}
              >
                {t(
                  `notifyPhones.${name === "numbers" ? "numbersTab" : "resendTab"}`,
                )}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`notifications-panel-${tab}`}
            aria-labelledby={`notifications-tab-${tab}`}
          >
            {tab === "numbers" ? (
              <NotificationNumbersTab />
            ) : (
              <LeadResendsTab
                selectedId={selectedId}
                onSelect={(id) => navigate("resend", id ?? undefined)}
              />
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
