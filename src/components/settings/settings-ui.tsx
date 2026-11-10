import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card with an icon, title and one-line description. */
export function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-4">
      <header className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            {title}
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {description}
          </p>
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Tinted row inside a section: icon, label and description, then controls. */
export function SettingsTile({
  icon,
  label,
  description,
  extra,
  children,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-ink-50/60 px-3.5 py-2.5 dark:border-ink-700 dark:bg-ink-900/30 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm dark:bg-ink-800 dark:text-brand-200">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">
            {label}
          </p>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {description}
          </p>
          {extra}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:justify-end">
        {children}
      </div>
    </div>
  );
}

/** One style for every either/or choice on the Settings page. */
export function SettingsSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1 dark:border-ink-600 dark:bg-ink-800"
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition",
              active
                ? "bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-900/40 dark:text-brand-100 dark:ring-brand-700"
                : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
