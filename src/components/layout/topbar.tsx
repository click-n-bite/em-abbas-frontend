"use client";

import { Menu } from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "./notification-bell";

interface Props {
  title: React.ReactNode;
  subtitle?: string;
  onMenu: () => void;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, onMenu, actions }: Props) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/80 backdrop-blur dark:border-ink-700 dark:bg-ink-800/80">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:flex">
        <button
          type="button"
          onClick={onMenu}
          aria-label={t("nav.dashboard")}
          className="rounded-xl border border-ink-200 p-2 text-ink-600 hover:bg-ink-100 dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-700 lg:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="col-start-2 min-w-0 flex-1">
          <h1 className="break-words text-base font-semibold text-ink-900 dark:text-ink-50 sm:truncate sm:text-lg">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-xs text-ink-500 dark:text-ink-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="col-span-3 row-start-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 dark:border-ink-700 lg:w-auto lg:justify-end lg:border-0 lg:pt-0">
          {actions ? <div className="min-w-0">{actions}</div> : null}
          <div className="ms-auto shrink-0">
            <LanguageSwitcher />
          </div>
        </div>
        <div className="col-start-3 row-start-1 flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
