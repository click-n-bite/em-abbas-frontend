"use client";

import {
  contactIdentifier,
  contactNameWithCountry,
} from "@/lib/channel-identity";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Clock,
  Headphones,
  MessageSquare,
  RefreshCw,
  UserRoundPlus,
} from "lucide-react";
import { adminApi, api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { leadsApi } from "@/lib/features/leads/api";
import { useNow } from "@/hooks/use-now";
import { usePoll } from "@/hooks/use-poll";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { ModeBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

interface Metric {
  key: string;
  label: string;
  detail?: string;
  value: number | null;
  icon: typeof Clock;
  tone: string;
  href: string;
}

export default function OverviewPage() {
  const { t, formatRelative } = useI18n();

  const now = useNow();

  const { agent, canManageUsers } = useAuth();

  const { unread } = useNotifications();

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [, setBlockedCount] = useState<number | null>(null);

  const [openLeads, setOpenLeads] = useState<number | null>(null);

  const [progressLeads, setProgressLeads] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tasks: Array<Promise<unknown>> = [
      api
        .conversations("all")
        .then((list) => {
          setConversations(list);
          setFailure(null);
        })
        .catch((error) => setFailure(errorKey(error))),
      adminApi
        .listBlockedCountries()
        .then((list) => setBlockedCount(list.length))
        .catch(() => setBlockedCount(null)),
      leadsApi
        .list({ status: "open", page: 0, size: 1 })
        .then((result) => setOpenLeads(result.total))
        .catch(() => setOpenLeads(null)),
      leadsApi
        .list({ status: "in_progress", page: 0, size: 1 })
        .then((result) => setProgressLeads(result.total))
        .catch(() => setProgressLeads(null)),
    ];

    await Promise.allSettled(tasks);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePoll(() => void load(), 30_000, true);

  const counts = useMemo(() => {
    let waiting = 0;

    let bot = 0;

    let withAgent = 0;

    let mine = 0;

    for (const conversation of conversations) {
      if (conversation.mode === "waiting") waiting += 1;

      if (conversation.mode === "bot") bot += 1;

      if (conversation.mode === "agent") withAgent += 1;

      if (agent && conversation.assigneeId === agent.id) mine += 1;
    }

    return { waiting, bot, withAgent, mine, total: conversations.length };
  }, [conversations, agent]);

  const metrics: Metric[] = [
    // {
    //   key: "waiting",
    //   label: t("overview.waiting"),
    //   value: counts.waiting,
    //   icon: Clock,
    //   tone: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-200",
    //   href: "/conversations?filter=waiting",
    // },
    {
      key: "openLeads",
      label: t("overview.openLeads"),
      value: openLeads,
      icon: UserRoundPlus,
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-200",
      href: "/leads?status=open",
    },
    // Regular agents own chats, so they keep "Assigned to me" in this slot.
    canManageUsers
      ? {
          key: "progressLeads",
          label: t("overview.progressLeads"),
          value: progressLeads,
          icon: Clock,
          tone: "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200",
          href: "/leads?status=in_progress",
        }
      : {
          key: "mine",
          label: t("overview.mine"),
          value: counts.mine,
          icon: Headphones,
          tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-200",
          href: "/conversations?filter=mine",
        },
    {
      key: "total",
      label: t("overview.total"),
      detail: t("overview.conversationSplit", {
        ai: counts.bot,
        agents: counts.withAgent,
      }),
      value: counts.total,
      icon: MessageSquare,
      tone: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200",
      href: "/conversations",
    },
    {
      key: "unread",
      label: t("overview.unread"),
      value: unread,
      icon: Bell,
      tone: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-200",
      href: "/notifications",
    },
  ];

  const recent = conversations.slice(0, 8);

  return (
    <AppShell
      title={t("overview.title")}
      subtitle={failure ? t(failure) : t("overview.subtitle")}
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary px-3 py-2"
          aria-label={t("common.refresh")}
          title={t("common.refresh")}
        >
          <RefreshCw
            className={cn("h-4 w-4", loading && "animate-spin")}
            aria-hidden="true"
          />
        </button>
      }
    >
      <div className="flex flex-col gap-3 lg:h-full lg:min-h-[28rem]">
        <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Link
                key={metric.key}
                href={metric.href}
                className="card flex animate-fade-in items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${metric.tone}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-semibold text-ink-900 dark:text-ink-50">
                    {loading && metric.value === null ? (
                      <span className="skeleton inline-block h-6 w-10 align-middle" />
                    ) : (
                      (metric.value ?? "—")
                    )}
                  </span>
                  <span className="block truncate text-xs text-ink-500 dark:text-ink-400">
                    {metric.label}
                  </span>
                  {metric.detail ? (
                    <span className="block truncate text-[11px] tabular-nums text-ink-400">
                      {metric.detail}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </section>

        <section className="card flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-700">
            <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">
              {t("overview.recent")}
            </h2>
            <Link
              href="/conversations"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
            >
              {t("overview.openInbox")}
              <ArrowRight
                className="h-4 w-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && recent.length === 0 ? (
              <ul className="space-y-3 p-5">
                {[0, 1, 2, 3].map((index) => (
                  <li key={index} className="flex items-center gap-3">
                    <span className="skeleton h-10 w-10 rounded-full" />
                    <span className="flex-1 space-y-2">
                      <span className="skeleton block h-3 w-1/3" />
                      <span className="skeleton block h-3 w-2/3" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
                title={t("inbox.empty")}
              />
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-700/70">
                {recent.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`/conversations?id=${conversation.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50 dark:hover:bg-ink-700/50"
                    >
                      <Avatar
                        name={conversation.customerName}
                        seed={conversation.id}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-50">
                          {contactNameWithCountry(conversation)}
                        </span>
                        <span className="block truncate text-xs text-ink-500 dark:text-ink-400">
                          {conversation.preview ??
                            contactIdentifier(conversation)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <ModeBadge mode={conversation.mode} />
                        {conversation.lastMessageAt ? (
                          <span className="text-[11px] text-ink-400">
                            {formatRelative(conversation.lastMessageAt, now)}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
