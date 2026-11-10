"use client";

import { useId, useRef } from "react";
import {
  CircleCheck,
  EllipsisVertical,
  Eye,
  Play,
  RotateCcw,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { LeadStatus } from "@/lib/types";
import { useI18n } from "@/providers/i18n-provider";

export function LeadTableActions({
  status,
  busy,
  onDetails,
  onChat,
  onChangeHandling,
  onClose,
  onReopen,
}: {
  status: LeadStatus;
  busy: boolean;
  onDetails: () => void;
  onChat: () => void;
  onChangeHandling: () => void;
  onClose: () => void;
  onReopen: () => void;
}) {
  const { t } = useI18n();

  const menuId = useId();

  const menu = useRef<HTMLDivElement>(null);

  const primary = {
    open: {
      label: t("leads.start"),
      icon: Play,
      action: onChangeHandling,
    },
    in_progress: {
      label: t("leads.confirmClose"),
      icon: CircleCheck,
      action: onClose,
    },
    closed: { label: t("leads.reopenLead"), icon: RotateCcw, action: onReopen },
  }[status];

  const Icon = primary.icon;

  const moreLabel = t("chat.moreActions");

  const run = (action: () => void) => {
    menu.current?.hidePopover();
    action();
  };

  const positionMenu = (trigger: HTMLButtonElement) => {
    if (!menu.current) return;

    const bounds = trigger.getBoundingClientRect();

    const rtl = getComputedStyle(trigger).direction === "rtl";

    // The native popover sits above the scroll container instead of being clipped by it.
    menu.current.style.insetInlineEnd = `${Math.max(8, rtl ? bounds.left : document.documentElement.clientWidth - bounds.right)}px`;

    const showAbove = window.innerHeight - bounds.bottom < 150;

    menu.current.style.top = showAbove ? "auto" : `${bounds.bottom + 4}px`;
    menu.current.style.bottom = showAbove
      ? `${window.innerHeight - bounds.top + 4}px`
      : "auto";
  };

  const itemClass =
    "block w-full rounded-md px-3 py-2 text-start text-sm hover:bg-ink-100 focus-visible:bg-ink-100 disabled:opacity-50 dark:hover:bg-ink-700 dark:focus-visible:bg-ink-700";

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        className="btn-ghost h-8 w-8 shrink-0 rounded-lg p-0"
        aria-label={t("leads.viewDetails")}
        title={t("leads.viewDetails")}
        onClick={onDetails}
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn-secondary h-8 whitespace-nowrap px-2.5 py-0 text-xs text-brand-700 dark:text-brand-200"
        disabled={busy}
        onClick={primary.action}
      >
        {busy ? (
          <Spinner />
        ) : (
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {primary.label}
      </button>
      <button
        type="button"
        className="btn-ghost h-8 w-6 shrink-0 rounded-lg p-0"
        aria-label={moreLabel}
        title={moreLabel}
        {...{ popovertarget: menuId }}
        onClick={(event) => positionMenu(event.currentTarget)}
      >
        <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <div
        ref={menu}
        id={menuId}
        {...{ popover: "auto" }}
        role="group"
        aria-label={moreLabel}
        className="fixed inset-auto m-0 min-w-44 max-w-[calc(100vw-1rem)] rounded-xl border border-ink-200 bg-white p-1 text-ink-800 shadow-lg dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
      >
        <button type="button" className={itemClass} onClick={() => run(onChat)}>
          {t("leads.viewChat")}
        </button>
        {status === "open" && (
          <button
            type="button"
            className={itemClass}
            disabled={busy}
            onClick={() => run(onClose)}
          >
            {t("leads.confirmClose")}
          </button>
        )}
        {status === "in_progress" && (
          <button
            type="button"
            className={itemClass}
            disabled={busy}
            onClick={() => run(onChangeHandling)}
          >
            {t("leads.returnToOpen")}
          </button>
        )}
      </div>
    </div>
  );
}
