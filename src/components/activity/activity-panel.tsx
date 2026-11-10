"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Eraser,
  Eye,
  EyeOff,
  Headphones,
  ShieldAlert,
  ShieldOff,
  Undo2,
  UserRound,
} from "lucide-react";
import { ApiError, activityApi } from "@/lib/api";
import { errorDetail, errorKey } from "@/lib/errors";
import { useI18n } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { sameSort, type SortState } from "@/lib/sorting";
import { SortControl } from "@/components/ui/sortable-header";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActivitySortField, ConversationActivityEvent } from "@/lib/types";

interface Props {
  conversationId: string;
  active: boolean;
}

type ActivitySort = SortState<ActivitySortField>;

// Newest first — the panel's long-standing display. (The API default, when no
// parameters are sent, is oldest first.)
const DEFAULT_SORT: ActivitySort = { field: "occurredAt", direction: "desc" };

const SORT_MENU_FIELDS: ActivitySortField[] = [
  "occurredAt",
  "eventType",
  "actorType",
  "actorName",
];

const eventIcons: Record<string, typeof Bot> = {
  "ai.started": Bot,
  "handoff.requested": AlertCircle,
  "agent.took_over": Headphones,
  handed_to_ai: Undo2,
  "number.blocked": ShieldOff,
  "identity.blocked": ShieldOff,
  "identity.unblocked": Undo2,
  "number.unblocked": Undo2,
  "conversation.hidden": EyeOff,
  "conversation.unhidden": Eye,
  "conversation.cleared": Eraser,
};

function EventRow({ event }: { event: ConversationActivityEvent }) {
  const { formatDateTime } = useI18n();

  const Icon = eventIcons[event.eventType] ?? UserRound;

  return (
    <li className="flex animate-fade-in gap-3 px-5 py-3.5">
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-300">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-800 dark:text-ink-100">
          {event.summary}
        </p>
        <p className="mt-0.5 text-xs text-ink-400">
          {formatDateTime(event.occurredAt)}
        </p>
      </div>
    </li>
  );
}

export function ActivityPanel({ conversationId, active }: Props) {
  const { t } = useI18n();

  const { push } = useToast();

  const [events, setEvents] = useState<ConversationActivityEvent[]>([]);

  const [loading, setLoading] = useState(false);

  const [failure, setFailure] = useState<string | null>(null);

  const [forbidden, setForbidden] = useState(false);

  const [sort, setSort] = useState<ActivitySort>(DEFAULT_SORT);

  // Last sort the server actually answered, so a failed change can be undone.
  const lastGoodSort = useRef<ActivitySort>(DEFAULT_SORT);

  useEffect(() => {
    if (!active || !conversationId) return;

    const controller = new AbortController();

    setLoading(true);
    setFailure(null);
    setForbidden(false);

    activityApi
      .get(
        conversationId,
        { sort: sort.field, direction: sort.direction },
        controller.signal,
      )
      .then((response) => {
        if (controller.signal.aborted) return;

        // Render the order the API returned — no browser-side sorting.
        setEvents(response.events);
        lastGoodSort.current = sort;
      })
      .catch((error) => {
        if ((error as Error)?.name === "AbortError") return;

        if (controller.signal.aborted) return;

        if (error instanceof ApiError && error.status === 403) {
          setForbidden(true);

          return;
        }

        if (!sameSort(sort, lastGoodSort.current)) {
          // Don't leave an indicator for an order that never loaded.
          setSort(lastGoodSort.current);
          push(errorDetail(error) ?? t("sorting.failed"), "error");

          return;
        }

        setFailure(errorKey(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, conversationId, sort]);

  if (!active) return null;

  if (forbidden) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
          title={t("activity.forbidden")}
        />
      </div>
    );
  }

  let body: React.ReactNode;

  if (loading && events.length === 0) {
    body = (
      <div className="flex flex-col gap-3 px-5 py-4">
        {[0, 1, 2].map((index) => (
          <span key={index} className="skeleton h-10 w-full" />
        ))}
      </div>
    );
  } else if (failure) {
    body = (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<AlertCircle className="h-5 w-5" aria-hidden="true" />}
          title={t(failure)}
        />
      </div>
    );
  } else if (events.length === 0) {
    body = (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
          title={t("activity.empty")}
        />
      </div>
    );
  } else {
    body = (
      <ul
        aria-busy={loading}
        className={
          "min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto dark:divide-ink-700/70" +
          (loading ? " opacity-60" : "")
        }
      >
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-shrink-0 items-center justify-end gap-2 border-b border-ink-100 px-5 py-2 dark:border-ink-700/70">
        <span className="text-xs text-ink-500 dark:text-ink-400">
          {t("sorting.sortByLabel")}
        </span>
        <SortControl
          sort={sort}
          onChange={setSort}
          options={SORT_MENU_FIELDS.map((field) => ({
            field,
            label: t(`sorting.activityFields.${field}`),
          }))}
          className="w-56 max-w-full"
          selectClassName="h-9 text-xs"
          buttonClassName="h-9 w-9"
        />
      </div>

      {body}
    </div>
  );
}
