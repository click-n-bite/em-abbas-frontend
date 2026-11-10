"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/ui/badges";
import { STORAGE_KEYS } from "@/lib/config";
import { visibleNavItems } from "./nav-items";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname();

  const { t } = useI18n();

  const { agent, role, signOut } = useAuth();

  const { unread } = useNotifications();

  const items = visibleNavItems(role);

  // Desktop only: the mobile slide-out menu always shows labels.
  // Every collapsed style below is lg-prefixed for that reason.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1",
      );
    } catch {
      // Storage unavailable: stay expanded.
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;

    setCollapsed(next);

    try {
      window.localStorage.setItem(
        STORAGE_KEYS.sidebarCollapsed,
        next ? "1" : "0",
      );
    } catch {
      // Not saved; the choice still applies until reload.
    }
  };

  const toggleLabel = collapsed ? t("nav.expand") : t("nav.collapse");

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 z-40 flex w-64 flex-col border-e border-ink-200 bg-white transition-[transform,width] duration-200 dark:border-ink-700 dark:bg-ink-800 lg:static lg:translate-x-0 lg:rtl:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
          collapsed && "lg:w-[4.5rem]",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-4 py-5",
            collapsed && "lg:flex-col lg:gap-3 lg:px-0",
          )}
        >
          <Link
            href="/overview"
            className="flex items-center gap-2.5"
            onClick={onClose}
            aria-label={t("common.appName")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className={cn("leading-tight", collapsed && "lg:hidden")}>
              <span className="block text-sm font-semibold text-ink-900 dark:text-ink-50">
                {t("common.appName")}
              </span>
              <span className="block text-[11px] text-ink-500 dark:text-ink-400">
                {t("common.appTagline")}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={toggleLabel}
            title={toggleLabel}
            aria-expanded={!collapsed}
            className="hidden rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-200 lg:block"
          >
            <ToggleIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700 lg:hidden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav
          className={cn(
            "flex-1 space-y-1 overflow-y-auto px-3 pb-4",
            collapsed && "lg:px-2",
          )}
        >
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            const Icon = item.icon;

            const label = t(item.labelKey);

            const badge =
              item.href === "/notifications" && unread > 0
                ? unread > 99
                  ? "99+"
                  : String(unread)
                : null;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                // Collapsed rows have no visible label, so the name shows on hover.
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  collapsed && "lg:justify-center lg:px-0",
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
                    : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700",
                )}
              >
                <span className="relative shrink-0">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {badge ? (
                    <span
                      className={cn(
                        "absolute -end-2.5 -top-2 hidden min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-white",
                        collapsed && "lg:block",
                      )}
                      aria-hidden="true"
                    >
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "flex-1 truncate capitalize",
                    collapsed && "lg:hidden",
                  )}
                >
                  {label}
                </span>
                {badge ? (
                  <span
                    className={cn(
                      "badge bg-rose-500 tabular-nums text-white",
                      collapsed && "lg:hidden",
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "border-t border-ink-200 p-3 dark:border-ink-700",
            collapsed && "lg:px-2",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl px-2 py-2",
              collapsed && "lg:justify-center lg:px-0",
            )}
            title={collapsed ? (agent?.name ?? undefined) : undefined}
          >
            <Avatar name={agent?.name} seed={agent?.email} size="sm" />
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">
                {agent?.name ?? t("common.unknown")}
              </p>
              <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                {agent?.email}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "mt-2 flex items-center justify-between gap-2 px-2",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <span className={cn(collapsed && "lg:hidden")}>
              <RoleBadge role={role} />
            </span>
            <button
              type="button"
              onClick={signOut}
              className="btn-ghost px-2 py-1.5 text-xs"
              title={t("common.signOut")}
              aria-label={t("common.signOut")}
            >
              <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              <span className={cn(collapsed && "lg:hidden")}>
                {t("common.signOut")}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
