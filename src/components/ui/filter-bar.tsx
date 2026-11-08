"use client";

import { useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  filtersLabel,
  activeCount = 0,
  hasActive = false,
  clearLabel,
  onClear,
  tabs,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  filtersLabel: string;
  activeCount?: number;
  hasActive?: boolean;
  clearLabel: string;
  onClear: () => void;
  tabs?: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const hasFilters = children !== undefined && children !== null;

  return (
    <header className="shrink-0 space-y-2 border-b border-ink-200 p-2 dark:border-ink-700 lg:px-4 lg:py-3">
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
        <div className="relative min-w-0 flex-1 lg:w-80 lg:flex-none">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="input h-11 w-full ps-10 lg:h-10"
          />
        </div>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className={cn(
              "btn-secondary h-11 shrink-0 gap-1.5 px-3 lg:hidden",
              open && "ring-2 ring-brand-500/30",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>{filtersLabel}</span>
            {activeCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
        ) : null}

        {tabs ? (
          <div className="w-full lg:w-auto lg:shrink-0">{tabs}</div>
        ) : null}
      </div>

      {hasFilters ? (
        <div
          className={cn(
            "w-full grid-cols-2 gap-2 rounded-xl border border-ink-200 bg-ink-50/60 p-2 dark:border-ink-700 dark:bg-ink-900/30",
            "lg:flex lg:flex-wrap lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:dark:bg-transparent",
            open ? "grid" : "hidden lg:flex",
          )}
        >
          {children}

          {hasActive ? (
            <button
              type="button"
              onClick={onClear}
              className="btn-ghost col-span-2 h-11 gap-1.5 px-3 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950 lg:col-span-1 lg:h-10 lg:flex-none"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span>{clearLabel}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
