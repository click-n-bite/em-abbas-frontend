/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { adminApi, api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { exportContactsToCsv } from "@/lib/export";
import { usePoll } from "@/hooks/use-poll";
import { useRealtime } from "@/hooks/use-realtime";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CountBadge } from "@/components/ui/count-badge";
import {
  ConversationList,
  type InboxFilter,
} from "@/components/chat/conversation-list";
import {
  contactSearchText,
  reconcileConversationBlock,
} from "@/lib/channel-identity";
import { cn } from "@/lib/utils";
import type {
  BlockedWhatsappNumber,
  Conversation,
  RealtimeEvent,
} from "@/lib/types";
import type { PortalUser } from "@/lib/features/users/types";

const FILTERS: InboxFilter[] = ["all", "bot", "agent", "mine", "hidden"];

function sortByRecent(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const left = a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? "";

    const right = b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? "";

    return right.localeCompare(left);
  });
}

function reconcileBlocked(
  list: Conversation[],
  blockedByPhone: Map<string, BlockedWhatsappNumber> | null,
): Conversation[] {
  return list.map((conversation) =>
    reconcileConversationBlock(
      conversation,
      conversation.phone &&
        (!conversation.channel || conversation.channel === "whatsapp")
        ? blockedByPhone?.get(conversation.phone)
        : undefined,
    ),
  );
}

function matchesFilter(
  conversation: Partial<Conversation>,
  filter: InboxFilter,
  agentId: string | null,
): boolean {
  if (filter === "hidden") return conversation.hidden === true;

  if (conversation.hidden) return false;

  if (filter === "all") return true;

  if (filter === "bot") return conversation.mode === "bot";

  if (filter === "agent") return conversation.mode === "agent";

  if (filter === "mine") {
    return (
      conversation.mode === "agent" &&
      conversation.assigneeId != null &&
      agentId != null &&
      String(conversation.assigneeId) === String(agentId)
    );
  }

  return false;
}

function laterTimestamp(
  current: string | null | undefined,
  incoming: string | null | undefined,
): string | null | undefined {
  if (!incoming) return current;

  if (!current) return incoming;

  const left = Date.parse(current);

  const right = Date.parse(incoming);

  if (Number.isNaN(right)) return current;

  if (Number.isNaN(left)) return incoming;

  return right >= left ? incoming : current;
}

/** Keep the newer received time when a stale snapshot arrives after a live update. */
function mergeConversation(
  existing: Conversation,
  incoming: Partial<Conversation>,
): Conversation {
  const merged: Conversation = { ...existing, ...incoming };

  const lastMessageAt = laterTimestamp(
    existing.lastMessageAt,
    incoming.lastMessageAt,
  );

  const keepExistingMessage =
    Boolean(existing.lastMessageAt) &&
    lastMessageAt === existing.lastMessageAt &&
    incoming.lastMessageAt !== existing.lastMessageAt;

  if (keepExistingMessage) {
    merged.lastMessageAt = existing.lastMessageAt;
    merged.preview = existing.preview;
    merged.lastMessageDirection = existing.lastMessageDirection;
    merged.lastMessageId = existing.lastMessageId;
    merged.unreadCount = existing.unreadCount;

    return merged;
  }

  if (lastMessageAt) merged.lastMessageAt = lastMessageAt;

  return merged;
}

function conversationPatchFromMessage(
  event: RealtimeEvent,
): (Partial<Conversation> & { id: string }) | null {
  const nested =
    event.message && typeof event.message === "object"
      ? (event.message as Record<string, unknown>)
      : null;

  const raw = nested
    ? { ...(event as Record<string, unknown>), ...nested }
    : (event as Record<string, unknown>);

  const conversationId = raw.conversationId ?? raw.conversation_id;

  if (typeof conversationId !== "string" && typeof conversationId !== "number")
    return null;

  const createdRaw = raw.createdAt ?? raw.created_at ?? raw.timestamp;

  const createdAt =
    typeof createdRaw === "string" && !Number.isNaN(Date.parse(createdRaw))
      ? createdRaw
      : null;

  const direction =
    raw.direction === "inbound" || raw.direction === "outbound"
      ? raw.direction
      : undefined;

  const text = typeof raw.text === "string" ? raw.text.trim() : "";

  const messageId = raw.messageId ?? raw.message_id;

  return {
    id: String(conversationId),
    ...(createdAt ? { lastMessageAt: createdAt } : {}),
    ...(direction ? { lastMessageDirection: direction } : {}),
    ...(text ? { preview: text } : {}),
    ...(typeof messageId === "string" || typeof messageId === "number"
      ? { lastMessageId: String(messageId) }
      : {}),
  };
}

export default function ConversationsPage() {
  const router = useRouter();

  const params = useSearchParams();

  const { t } = useI18n();

  const { agent, canManageUsers } = useAuth();

  const requestedId = params.get("id");

  const requestedFilter = params.get("filter");

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const hiddenIdsRef = useRef<Set<string>>(new Set());

  const [filter, setFilter] = useState<InboxFilter>(
    FILTERS.includes(requestedFilter as InboxFilter)
      ? (requestedFilter as InboxFilter)
      : "all",
  );

  const [search, setSearch] = useState("");

  const [activeId, setActiveId] = useState<string | null>(requestedId);

  const [loading, setLoading] = useState(true);

  const [failure, setFailure] = useState<string | null>(null);

  const loadSeq = useRef(0);

  const [agents, setAgents] = useState<PortalUser[]>([]);

  const [agentFilter, setAgentFilter] = useState<string>("all");

  useEffect(() => {
    if (!canManageUsers) return;

    let cancelled = false;

    adminApi
      .listUsers()
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [canManageUsers]);

  useEffect(() => {
    if (!canManageUsers) setAgentFilter("all");
  }, [canManageUsers]);

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();

    agents.forEach((user) =>
      map.set(user.id, user.displayName || user.username),
    );

    return map;
  }, [agents]);

  const load = useCallback(
    async (silent = false) => {
      const seq = ++loadSeq.current;

      if (!silent) setLoading(true);

      try {
        const [list, blockedEntries] = await Promise.all([
          api.conversations(filter),
          canManageUsers
            ? adminApi.listBlockedNumbers("blocked").catch(() => null)
            : Promise.resolve(null),
        ]);

        if (seq !== loadSeq.current) return;

        const blockedByPhone = blockedEntries
          ? new Map(
              blockedEntries.map((entry) => [entry.phone, entry] as const),
            )
          : null;

        setConversations((current) => {
          const localById = new Map(current.map((item) => [item.id, item]));

          return sortByRecent(
            reconcileBlocked(list, blockedByPhone).map((server) => {
              const local = localById.get(server.id);

              return local ? mergeConversation(local, server) : server;
            }),
          );
        });
        setFailure(null);

        if (filter === "hidden") {
          hiddenIdsRef.current = new Set(list.map((item) => item.id));
        }

        const needsName = list.filter(
          (item) => item.mode === "agent" && item.assigneeId && !item.assignee,
        );

        if (needsName.length > 0) {
          void Promise.allSettled(
            needsName.map((item) => api.conversation(item.id)),
          ).then((results) => {
            if (seq !== loadSeq.current) return;

            results.forEach((result) => {
              if (result.status !== "fulfilled") return;

              const fresh = result.value;

              setConversations((current) =>
                current.map((item) =>
                  item.id === fresh.id
                    ? mergeConversation(item, {
                        assignee: fresh.assignee ?? null,
                      })
                    : item,
                ),
              );
            });
          });
        }
      } catch (error) {
        if (seq !== loadSeq.current) return;

        setFailure(errorKey(error));
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [filter, canManageUsers],
  );

  useEffect(() => {
    void load();
  }, [load]);

  usePoll(() => void load(true), 30_000, true);

  useEffect(() => {
    if ((filter === "hidden" || filter === "agent") && !canManageUsers)
      setFilter("all");

    if (filter === "mine" && canManageUsers) setFilter("all");
  }, [filter, canManageUsers]);

  useEffect(() => {
    if (requestedId) setActiveId(requestedId);
  }, [requestedId]);

  useEffect(() => {
    const query = new URLSearchParams(params.toString());

    if (activeId) {
      query.set("id", activeId);
    } else {
      query.delete("id");
    }

    if (filter !== "all") {
      query.set("filter", filter);
    } else {
      query.delete("filter");
    }

    const search = query.toString();

    router.replace(search ? `/conversations?${search}` : "/conversations", {
      scroll: false,
    });
  }, [activeId, filter, params, router]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    let inTab = conversations.filter((conversation) =>
      matchesFilter(conversation, filter, agent?.id ?? null),
    );

    if (canManageUsers && agentFilter !== "all") {
      inTab = inTab.filter(
        (conversation) => conversation.assigneeId === agentFilter,
      );
    }

    if (!needle) return inTab;

    return inTab.filter((conversation) => {
      const name = conversation.customerName?.toLowerCase() ?? "";

      const assigneeName = (
        conversation.assignee?.name ??
        (conversation.assigneeId
          ? agentNameById.get(conversation.assigneeId)
          : "") ??
        ""
      ).toLowerCase();

      return (
        name.includes(needle) ||
        contactSearchText(conversation).includes(needle) ||
        assigneeName.includes(needle)
      );
    });
  }, [
    conversations,
    search,
    filter,
    agent?.id,
    canManageUsers,
    agentFilter,
    agentNameById,
  ]);

  const active = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeId) ??
      null,
    [conversations, activeId],
  );

  const [detached, setDetached] = useState<Conversation | null>(null);

  useEffect(() => {
    if (!activeId || active) {
      setDetached(null);

      return;
    }

    let cancelled = false;

    api
      .conversation(activeId)
      .then((conversation) => {
        if (!cancelled) setDetached(conversation);
      })
      .catch(() => {
        if (!cancelled) setDetached(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, active]);

  const selected = active ?? detached;

  const onConversationChange = useCallback((next: Conversation) => {
    if (next.hidden === true) hiddenIdsRef.current.add(next.id);
    else if (next.hidden === false) hiddenIdsRef.current.delete(next.id);

    setConversations((current) => {
      const exists = current.some(
        (conversation) => conversation.id === next.id,
      );

      if (!exists) {
        // Chat opened from outside the current tab (kept in `detached`).
        // Don't inject it into the list, or it will be dropped again by the
        // next realtime event and cause a flicker loop.
        if (!matchesFilter(next, filterRef.current, agentIdRef.current)) {
          return current;
        }

        return sortByRecent([next, ...current]);
      }

      return sortByRecent(
        current.map((conversation) =>
          conversation.id === next.id
            ? mergeConversation(conversation, next)
            : conversation,
        ),
      );
    });

    setDetached((current) =>
      current && current.id === next.id
        ? mergeConversation(current, next)
        : current,
    );
  }, []);

  const activeIdRef = useRef(activeId);

  activeIdRef.current = activeId;

  const filterRef = useRef(filter);

  filterRef.current = filter;

  const agentIdRef = useRef<string | null>(agent?.id ?? null);

  agentIdRef.current = agent?.id ?? null;
  activeIdRef.current = activeId;

  filterRef.current = filter;

  agentIdRef.current = agent?.id ?? null;

  const upsert = useCallback(
    (
      partial: Partial<Conversation> & { id: string },
      options?: { insert?: boolean },
    ) => {
      const insert = options?.insert !== false;

      const safePartial = partial;

      if (safePartial.hidden === true) {
        hiddenIdsRef.current.add(safePartial.id);
      }

      setConversations((current) => {
        const idx = current.findIndex(
          (conversation) => conversation.id === safePartial.id,
        );

        const knownHidden = hiddenIdsRef.current.has(safePartial.id);

        if (idx === -1) {
          if (!insert) return current;

          const effective = knownHidden
            ? { ...safePartial, hidden: true }
            : safePartial;

          if (!matchesFilter(effective, filterRef.current, agentIdRef.current))
            return current;

          return sortByRecent([
            { unreadCount: 0, ...effective } as Conversation,
            ...current,
          ]);
        }

        const existing = current[idx];

        const merged: Conversation = mergeConversation(existing, safePartial);

        merged.hidden = knownHidden ? true : existing.hidden;

        if (!matchesFilter(merged, filterRef.current, agentIdRef.current)) {
          if (merged.id === activeIdRef.current) {
            const next = [...current];

            next[idx] = merged;

            return sortByRecent(next);
          }

          return current.filter((c) => c.id !== safePartial.id);
        }

        if (
          safePartial.lastMessageDirection === "inbound" &&
          safePartial.id !== activeIdRef.current &&
          safePartial.unreadCount === undefined
        ) {
          merged.unreadCount = (existing.unreadCount ?? 0) + 1;
        }

        const next = [...current];

        next[idx] = merged;

        return sortByRecent(next);
      });

      setDetached((current) =>
        current && current.id === safePartial.id
          ? mergeConversation(current, safePartial)
          : current,
      );

      if (
        hiddenIdsRef.current.has(safePartial.id) &&
        activeIdRef.current === safePartial.id &&
        filterRef.current !== "hidden"
      ) {
        setActiveId(null);
      }
    },
    [],
  );

  const applyHiddenChange = useCallback((id: string, hidden: boolean) => {
    if (hidden) {
      hiddenIdsRef.current.add(id);

      setConversations((current) => {
        const idx = current.findIndex((conversation) => conversation.id === id);

        if (idx === -1) return current;

        const hiddenConversation = { ...current[idx], hidden: true };

        if (
          !matchesFilter(
            hiddenConversation,
            filterRef.current,
            agentIdRef.current,
          )
        ) {
          return current.filter((conversation) => conversation.id !== id);
        }

        const next = [...current];

        next[idx] = hiddenConversation;

        return next;
      });

      setDetached((current) =>
        current && current.id === id ? { ...current, hidden: true } : current,
      );

      if (activeIdRef.current === id && filterRef.current !== "hidden") {
        setActiveId(null);
      }

      return;
    }

    hiddenIdsRef.current.delete(id);

    void api
      .conversation(id)
      .then((fresh) => {
        const restored: Conversation = { ...fresh, hidden: false };

        setConversations((current) => {
          const idx = current.findIndex(
            (conversation) => conversation.id === id,
          );

          if (idx === -1) {
            if (!matchesFilter(restored, filterRef.current, agentIdRef.current))
              return current;

            return sortByRecent([
              { unreadCount: 0, ...restored } as Conversation,
              ...current,
            ]);
          }

          const merged = { ...current[idx], ...restored };

          if (!matchesFilter(merged, filterRef.current, agentIdRef.current)) {
            if (id === activeIdRef.current) {
              const keep = [...current];

              keep[idx] = merged;

              return sortByRecent(keep);
            }

            return current.filter((conversation) => conversation.id !== id);
          }

          const next = [...current];

          next[idx] = merged;

          return sortByRecent(next);
        });

        setDetached((current) =>
          current && current.id === id ? { ...current, ...restored } : current,
        );
      })
      .catch(() => undefined);
  }, []);

  const handleToggleHide = useCallback(
    async (id: string, hide: boolean) => {
      const updated = hide
        ? await api.hideConversation(id)
        : await api.unhideConversation(id);

      const resolvedHidden = updated.hidden ?? hide;

      applyHiddenChange(id, resolvedHidden);

      if (!resolvedHidden) onConversationChange(updated);
    },
    [applyHiddenChange, onConversationChange],
  );

  const upsertBlockedStatus = useCallback(
    (
      id: string,
      blocked: boolean,
      whatsappStatus: Conversation["whatsappStatus"] | null,
      identity: Partial<Conversation> = {},
    ) => {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id
            ? { ...conversation, ...identity, blocked, whatsappStatus }
            : conversation,
        ),
      );
      setDetached((current) =>
        current && current.id === id
          ? { ...current, ...identity, blocked, whatsappStatus }
          : current,
      );
    },
    [],
  );

  const onRealtimeEvent = useCallback(
    (payload: unknown) => {
      const event = payload as RealtimeEvent | null;

      if (!event || typeof event.event !== "string") return;

      switch (event.event) {
        case "conversation.upserted": {
          const { event: _ignored, ...rest } = event;

          const raw = rest as Record<string, unknown>;

          const id = raw.id ?? raw.conversationId ?? raw.conversation_id;

          if (id == null || id === "") break;

          const lastMessageAt =
            typeof raw.lastMessageAt === "string"
              ? raw.lastMessageAt
              : typeof raw.last_message_at === "string"
                ? raw.last_message_at
                : undefined;

          const patch: Partial<Conversation> & { id: string } = {
            ...(rest as Partial<Conversation>),
            id: String(id),
          };

          if (lastMessageAt) patch.lastMessageAt = lastMessageAt;
          else delete patch.lastMessageAt;

          upsert(patch);

          break;
        }

        case "message.created": {
          const patch = conversationPatchFromMessage(event);

          if (!patch) break;

          upsert(patch, { insert: false });

          break;
        }

        case "handoff.requested": {
          const conversationId = event.conversationId as string | undefined;

          if (!conversationId) break;

          upsert({
            id: conversationId,
            mode: (event.mode as Conversation["mode"]) ?? "bot",
            preview: (event.preview as string | null | undefined) ?? undefined,
            handoffRequested: true,
          });

          break;
        }

        case "conversation.assigned": {
          const conversationId = event.conversationId as string | undefined;

          if (!conversationId) break;

          const nextAssigneeId =
            (event.assigneeId as string | null | undefined) ?? null;

          upsert({
            id: conversationId,
            mode: (event.mode as Conversation["mode"]) ?? "agent",
            assigneeId: nextAssigneeId,
            assignee:
              nextAssigneeId && agent && nextAssigneeId === agent.id
                ? { id: agent.id, name: agent.name, email: agent.email }
                : null,
          });

          if (nextAssigneeId && nextAssigneeId !== agent?.id) {
            void api
              .conversation(conversationId)
              .then((fresh) =>
                upsert({
                  id: conversationId,
                  assignee: fresh.assignee ?? null,
                }),
              )
              .catch(() => undefined);
          }

          break;
        }

        case "conversation.blocked": {
          const conversationId = event.conversationId as string | undefined;

          if (!conversationId) break;

          upsertBlockedStatus(
            conversationId,
            Boolean(event.blocked),
            (event.whatsappStatus as Conversation["whatsappStatus"]) ?? null,
            typeof event.identityBlocked === "boolean"
              ? {
                  identityBlocked: event.identityBlocked,
                  identityBlockSource:
                    event.identityBlockSource as Conversation["identityBlockSource"],
                  identityBlockExpiresAt: event.identityBlockExpiresAt as
                    | string
                    | null,
                }
              : {},
          );

          break;
        }

        case "conversation.read": {
          const conversationId = event.conversationId as string | undefined;

          if (!conversationId) break;

          upsert({
            id: conversationId,
            unreadCount: (event.unreadCount as number | undefined) ?? 0,
            lastReadAt: (event.lastReadAt as string | undefined) ?? null,
          });

          break;
        }

        case "conversation.hidden": {
          const conversationId = event.conversationId as string | undefined;

          if (!conversationId) break;

          applyHiddenChange(conversationId, true);

          break;
        }

        case "conversation.unhidden": {
          const conversationId = event.conversationId as string | undefined;

          if (!conversationId) break;

          applyHiddenChange(conversationId, false);

          break;
        }

        default:
          break;
      }
    },
    [upsert, upsertBlockedStatus, applyHiddenChange, agent],
  );

  const socketTopics = useMemo(() => {
    if (!agent?.id) return [];

    return ["/topic/inbox", `/topic/agent/${agent.id}`];
  }, [agent?.id]);

  useRealtime({
    topics: socketTopics,
    onEvent: onRealtimeEvent,
    enabled: Boolean(agent),
  });

  return (
    <AppShell
      flush
      title={
        <>
          {t("inbox.title")}
          {!loading && !failure ? <CountBadge count={filtered.length} /> : null}
        </>
      }
      subtitle={failure ? t(failure) : t("inbox.selectHint")}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportContactsToCsv(filtered)}
            disabled={filtered.length === 0}
            className="btn-secondary inline-flex items-center gap-2 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("inbox.exportContacts")}
            title={t("inbox.exportContacts")}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {t("inbox.exportContacts")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void load(true)}
            className="btn-secondary px-3 py-2"
            aria-label={t("common.refresh")}
            title={t("common.refresh")}
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        </div>
      }
    >
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div
          className={cn(
            "card min-h-0 overflow-hidden",
            selected ? "hidden lg:block" : "block",
          )}
        >
          <ConversationList
            conversations={filtered}
            activeId={activeId}
            filter={filter}
            search={search}
            loading={loading}
            onSelect={setActiveId}
            onFilterChange={(next) => {
              setFilter(next);
              setActiveId(null);
              setLoading(true);
            }}
            onSearchChange={setSearch}
            onToggleHide={canManageUsers ? handleToggleHide : undefined}
            agents={canManageUsers ? agents : []}
            agentFilter={agentFilter}
            onAgentFilterChange={canManageUsers ? setAgentFilter : undefined}
          />
        </div>

        <div
          className={cn(
            "min-h-0 overflow-hidden transition-transform duration-300 ease-out",
            "fixed inset-0 z-40 bg-white dark:bg-ink-900",
            "lg:static lg:z-auto lg:translate-x-0 lg:rounded-2xl lg:border lg:border-ink-200 lg:bg-white lg:shadow-sm lg:transition-none lg:dark:border-ink-700 lg:dark:bg-ink-800",
            selected
              ? "translate-x-0"
              : "pointer-events-none translate-x-full lg:pointer-events-auto",
          )}
        >
          <ChatPanel
            conversation={selected}
            onConversationChange={onConversationChange}
            onBack={() => setActiveId(null)}
            onToggleHide={handleToggleHide}
          />
        </div>
      </div>
    </AppShell>
  );
}
