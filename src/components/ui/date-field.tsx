"use client";

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export function DateField({
  value,
  onChange,
  display,
  label,
  min,
  max,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  display: string;
  label: string;
  min?: string;
  max?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "input relative flex h-11 w-full min-w-0 items-center gap-2 lg:h-10 lg:w-40",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          value
            ? "text-ink-900 dark:text-ink-100"
            : "text-ink-400 dark:text-ink-500",
        )}
      >
        {display}
      </span>
      <Calendar className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker();
          } catch {
            // showPicker not supported: native behavior still works
          }
        }}
        aria-label={label}
        title={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
