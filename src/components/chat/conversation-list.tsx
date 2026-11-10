"use client";

import {
  contactIdentifier,
  contactNameWithCountry,
} from "@/lib/channel-identity";
import { useId, useRef, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  Inbox,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/providers/i18n-provider";
import { useAuth } from "@/providers/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { ModeBadge, BlockedBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { cn, textDirOf } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import type { PortalUser } from "@/lib/features/users/types";

export type InboxFilter = "all" | "bot" | "agent" | "mine" | "hidden";

const filters: InboxFilter[] = ["all", "bot", "agent", "mine", "hidden"];

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  filter: InboxFilter;
  search: string;
  loading: boolean;
  onSelect: (id: string) => void;
  onFilterChange: (filter: InboxFilter) => void;
  onSearchChange: (value: string) => void;
  onToggleHide?: (id: string, hide: boolean) => void | Promise<void>;
  onToggleBlock?: (id: string, block: boolean) => void | Promise<void>;
  onClearHidden?: () => void | Promise<void>;
  clearingHidden?: boolean;
  agents?: PortalUser[];
  agentFilter?: string;
  onAgentFilterChange?: (agentId: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  filter,
  search,
  loading,
  onSelect,
  onFilterChange,
  onSearchChange,
  onToggleHide,
  onToggleBlock,
  agents = [],
  agentFilter = "all",
  onAgentFilterChange,
}: Props) {
  const { t, formatRelative } = useI18n();

  const now = useNow();

  const { agent, canManageUsers } = useAuth();

  const [busyId, setBusyId] = useState<string | null>(null);

  const showAgentFilter = agents.length > 0 && Boolean(onAgentFilterChange);

  const agentMenuId = useId();

  const agentMenu = useRef<HTMLDivElement>(null);

  const selectedAgent =
    agentFilter === "all"
      ? null
      : (agents.find((user) => user.id === agentFilter) ?? null);

  const selectedAgentName = selectedAgent
    ? selectedAgent.displayName || selectedAgent.username
    : null;

  const pickAgent = (id: string) => {
    agentMenu.current?.hidePopover();
    onAgentFilterChange?.(id);
  };

  // Same native-popover placement as the Leads row menu, so the list isn't clipped.
  const positionAgentMenu = (trigger: HTMLButtonElement) => {
    if (!agentMenu.current) return;

    const bounds = trigger.getBoundingClientRect();

    const rtl = getComputedStyle(trigger).direction === "rtl";

    agentMenu.current.style.insetInlineEnd = `${Math.max(8, rtl ? bounds.left : document.documentElement.clientWidth - bounds.right)}px`;
    agentMenu.current.style.top = `${bounds.bottom + 4}px`;
  };

  const agentItemClass =
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm hover:bg-ink-100 focus-visible:bg-ink-100 dark:hover:bg-ink-700 dark:focus-visible:bg-ink-700";

  const toggleHide = async (id: string, hide: boolean) => {
    if (!onToggleHide) return;

    setBusyId(id);

    try {
      await onToggleHide(id, hide);
    } finally {
      setBusyId((current) => (current === id ? null : current));
    }
  };

  const toggleBlock = async (id: string, block: boolean) => {
    if (!onToggleBlock) return;

    setBusyId(id);

    try {
      await onToggleBlock(id, block);
    } finally {
      setBusyId((current) => (current === id ? null : current));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-ink-200 p-3 dark:border-ink-700">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("inbox.searchPlaceholder")}
              aria-label={t("common.search")}
              className="input h-9 py-0 ps-9 lg:!text-sm"
            />
          </div>

          {/* Admin/superadmin only — narrows the "All"/"Agent" tabs to one agent's chats. */}
          {showAgentFilter ? (
            <>
              <button
                type="button"
                className={cn(
                  "btn-secondary relative h-9 w-9 shrink-0 justify-center p-0",
                  selectedAgent && "text-brand-600 dark:text-brand-300",
                )}
                aria-label={t("inbox.filterByAgent")}
                title={t("inbox.filterByAgent")}
                aria-haspopup="true"
                {...{ popovertarget: agentMenuId }}
                onClick={(event) => positionAgentMenu(event.currentTarget)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {selectedAgent ? (
                  <span
                    className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
              <div
                ref={agentMenu}
                id={agentMenuId}
                {...{ popover: "auto" }}
                role="group"
                aria-label={t("inbox.filterByAgent")}
                className="fixed inset-auto m-0 max-h-80 min-w-48 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-ink-200 bg-white p-1 text-ink-800 shadow-lg dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
              >
                {[
                  { id: "all", name: t("inbox.allAgents") },
                  ...agents.map((user) => ({
                    id: user.id,
                    name: user.displayName || user.username,
                  })),
                ].map((option) => {
                  const selected = agentFilter === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        agentItemClass,
                        selected && "text-brand-700 dark:text-brand-200",
                      )}
                      onClick={() => pickAgent(option.id)}
                    >
                      <span
                        className="min-w-0 flex-1 truncate"
                        dir={textDirOf(option.name)}
                      >
                        {option.name}
                      </span>
                      {selected ? (
                        <Check
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <div
          role="tablist"
          className="flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900"
        >
          {filters
            // "Hidden" and "Agent" (all human-assigned chats, not just the caller's own) are
            // admin/superadmin-only review tools. "Mine" only makes sense for a regular agent —
            // admins/superadmins are view-only and can never actually own a chat (see
            // chat-panel's canChangeMode), so it's replaced by the "Agent" tab + agent picker for them.
            .filter((value) =>
              value === "hidden" || value === "agent"
                ? canManageUsers
                : value === "mine"
                  ? !canManageUsers
                  : true,
            )
            .map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => onFilterChange(value)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                  filter === value
                    ? "bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-brand-100"
                    : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
                )}
              >
                {t(`inbox.filters.${value}`)}
              </button>
            ))}
        </div>

        {selectedAgentName ? (
          <span className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-brand-50 pe-1 ps-2.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">
            <span className="truncate">
              {t("inbox.agentChip", { name: selectedAgentName })}
            </span>
            <button
              type="button"
              onClick={() => onAgentFilterChange?.("all")}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-800"
              aria-label={t("inbox.clearAgentFilter")}
              title={t("inbox.clearAgentFilter")}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <ul className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((index) => (
              <li key={index} className="flex gap-3">
                <span className="skeleton h-10 w-10 rounded-full" />
                <span className="flex-1 space-y-2 py-1">
                  <span className="skeleton block h-3 w-1/2" />
                  <span className="skeleton block h-3 w-3/4" />
                </span>
              </li>
            ))}
          </ul>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" aria-hidden="true" />}
            title={t(filter === "hidden" ? "inbox.hiddenEmpty" : "inbox.empty")}
          />
        ) : (
          <ul className="h-[100px] divide-y divide-ink-100 dark:divide-ink-700/70 md:h-full">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;

              const name = contactNameWithCountry(conversation);

              const mine =
                conversation.assigneeId &&
                conversation.assigneeId === agent?.id;

              const unread = conversation.unreadCount ?? 0;

              return (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 p-3 text-start transition",
                      onToggleHide && "pe-11",
                      conversation.blocked
                        ? "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60"
                        : active
                          ? "bg-brand-50 dark:bg-brand-900/30"
                          : "hover:bg-ink-50 dark:hover:bg-ink-700/50",
                      conversation.blocked &&
                        active &&
                        "ring-1 ring-inset ring-rose-300 dark:ring-rose-700",
                    )}
                  >
                    <Avatar
                      name={conversation.customerName}
                      seed={conversation.id}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          dir={textDirOf(name)}
                          className={cn(
                            "truncate text-sm text-ink-900 dark:text-ink-50",
                            unread > 0 ? "font-semibold" : "font-medium",
                          )}
                        >
                          {name}
                        </span>
                        {conversation.lastMessageAt ? (
                          <span className="shrink-0 text-[11px] text-ink-400">
                            {formatRelative(conversation.lastMessageAt, now)}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          dir={textDirOf(conversation.preview)}
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs",
                            unread > 0
                              ? "font-medium text-ink-800 dark:text-ink-100"
                              : "text-ink-500 dark:text-ink-400",
                          )}
                        >
                          {conversation.preview ??
                            contactIdentifier(conversation)}
                        </span>
                        {unread > 0 ? (
                          <span
                            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold tabular-nums text-white"
                            aria-label={t("inbox.unreadCount", { n: unread })}
                          >
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <ModeBadge mode={conversation.mode} />
                        {conversation.blocked ? (
                          <BlockedBadge
                            whatsappStatus={conversation.whatsappStatus}
                          />
                        ) : null}
                        {/* Assignment only means anything once a human has it — an AI/waiting
												    chat has no assignee to speak of, so don't show "Unassigned" noise. */}
                        {conversation.mode === "agent" ? (
                          <span className="truncate text-[11px] text-ink-400">
                            {conversation.assigneeId
                              ? t("inbox.assignedTo", {
                                  name: mine
                                    ? t("inbox.you")
                                    : (conversation.assignee?.name ??
                                      t("common.unknown")),
                                })
                              : t("inbox.unassigned")}
                          </span>
                        ) : null}
                        {onToggleBlock ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleBlock(
                                conversation.id,
                                !conversation.blocked,
                              );
                            }}
                            disabled={busyId === conversation.id}
                            className={cn(
                              "ms-auto text-[11px] font-medium transition",
                              conversation.blocked
                                ? "text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
                                : "text-ink-400 hover:text-rose-600 dark:text-ink-500 dark:hover:text-rose-400",
                            )}
                          >
                            {busyId === conversation.id ? (
                              <Spinner />
                            ) : conversation.blocked ? (
                              t("inbox.quickUnblock")
                            ) : (
                              t("inbox.quickBlock")
                            )}
                          </button>
                        ) : null}
                      </span>
                    </span>
                  </button>

                  {onToggleHide ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleHide(conversation.id, filter !== "hidden");
                      }}
                      disabled={busyId === conversation.id}
                      title={t(
                        filter === "hidden"
                          ? "inbox.unhideConversation"
                          : "inbox.hideConversation",
                      )}
                      aria-label={t(
                        filter === "hidden"
                          ? "inbox.unhideConversation"
                          : "inbox.hideConversation",
                      )}
                      className={cn(
                        "absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100",
                        filter === "hidden"
                          ? "opacity-100"
                          : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
                      )}
                    >
                      {busyId === conversation.id ? (
                        <Spinner />
                      ) : filter === "hidden" ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
