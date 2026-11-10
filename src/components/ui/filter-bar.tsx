"use client";

import { useId, useState, type ReactNode } from "react";
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
  inlineFilter,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  filtersLabel?: string;
  activeCount?: number;
  hasActive?: boolean;
  clearLabel?: string;
  onClear?: () => void;
  tabs?: ReactNode;
  children?: ReactNode;
  inlineFilter?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const filtersId = useId();

  const hasFilters = children !== undefined && children !== null;

  return (
    <header className="shrink-0 space-y-3 border-b border-ink-200 p-3 dark:border-ink-700 lg:px-5 lg:py-3">
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="input h-11 w-full ps-10 lg:h-10"
          />
        </div>

        {/* Below lg the tabs take their own full-width row above the search. */}
        {tabs ? (
          <div className="order-first w-full lg:order-none lg:w-auto lg:shrink-0">
            {tabs}
          </div>
        ) : null}

        {inlineFilter}
        {hasFilters ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={filtersId}
            className={cn(
              "btn-secondary h-11 shrink-0 gap-1.5 px-3 lg:h-10",
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
      </div>

      {hasFilters ? (
        <div
          id={filtersId}
          hidden={!open}
          className={cn(
            "w-full grid-cols-2 gap-2 rounded-xl border border-ink-200 bg-ink-50/60 p-2 dark:border-ink-700 dark:bg-ink-900/30",
            open
              ? "grid lg:flex lg:flex-wrap lg:items-center lg:gap-3"
              : "hidden",
          )}
        >
          {children}

          {hasActive && onClear ? (
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

export function FilterTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; count?: number | null }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex min-h-10 gap-1 rounded-xl bg-ink-100/70 p-1 dark:bg-ink-900"
    >
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition lg:flex-none lg:flex-row lg:whitespace-nowrap lg:px-3",
              selected
                ? "bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-brand-100"
                : "text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white",
            )}
          >
            {option.label}
            {option.count != null ? (
              <span
                className={cn(
                  "rounded-md px-1.5 text-[11px] font-semibold tabular-nums",
                  selected
                    ? "bg-brand-600 text-white"
                    : "bg-ink-200 dark:bg-ink-700",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
