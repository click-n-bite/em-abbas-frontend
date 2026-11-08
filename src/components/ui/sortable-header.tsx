"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/i18n-provider";
import { Select } from "@/components/ui/select";
import type { SortState } from "@/lib/sorting";

export function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc";
}) {
  const on = "text-brand-600 dark:text-brand-300";

  const off = "text-ink-400 dark:text-ink-500";

  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 flex-shrink-0 flex-col items-center justify-center -space-y-1"
    >
      <ChevronUp
        strokeWidth={3}
        className={cn(
          "h-2.5 w-2.5 shrink-0",
          active && direction === "asc" ? on : off,
        )}
      />
      <ChevronDown
        strokeWidth={3}
        className={cn(
          "h-2.5 w-2.5 shrink-0",
          active && direction === "desc" ? on : off,
        )}
      />
    </span>
  );
}

interface SortableThProps<F extends string> {
  label: string;
  field: F;
  sort: SortState<F>;
  onSort: (field: F) => void;
  className?: string;
}

function ariaSortOf<F extends string>(
  sort: SortState<F>,
  field: F,
): "ascending" | "descending" | undefined {
  if (sort.field !== field) return undefined;

  return sort.direction === "asc" ? "ascending" : "descending";
}

function SortButton<F extends string>({
  label,
  field,
  sort,
  onSort,
  uppercase,
}: SortableThProps<F> & { uppercase?: boolean }) {
  const { t } = useI18n();

  const active = sort.field === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      title={t("sorting.sortBy", { label })}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-1 py-0.5 font-[inherit] transition hover:text-ink-700 dark:hover:text-ink-200",
        uppercase && "uppercase tracking-[inherit]",
        active && "text-ink-700 dark:text-ink-100",
      )}
    >
      <span>{label}</span>
      <SortIcon active={active} direction={sort.direction} />
      <span className="sr-only">
        {active
          ? sort.direction === "asc"
            ? t("sorting.ascending")
            : t("sorting.descending")
          : t("sorting.sortBy", { label })}
      </span>
    </button>
  );
}

/** Table header cell with a button, two-arrow indicator and `aria-sort`. */
export function SortableTh<F extends string>(props: SortableThProps<F>) {
  return (
    <th
      scope="col"
      aria-sort={ariaSortOf(props.sort, props.field)}
      className={props.className}
    >
      <SortButton {...props} uppercase />
    </th>
  );
}

/** Same as SortableTh, for div-based (grid) column headers. */
export function SortableColumnHeader<F extends string>(
  props: SortableThProps<F>,
) {
  return (
    <div
      role="columnheader"
      aria-sort={ariaSortOf(props.sort, props.field)}
      className={props.className}
    >
      <SortButton {...props} />
    </div>
  );
}

interface SortControlProps<F extends string> {
  options: { field: F; label: string }[];
  sort: SortState<F>;
  onChange: (next: SortState<F>) => void;
  className?: string;
  selectClassName?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

/** Field dropdown + direction button (used where table headers aren't shown). */
export function SortControl<F extends string>({
  options,
  sort,
  onChange,
  className,
  selectClassName,
  buttonClassName,
  disabled,
}: SortControlProps<F>) {
  const { t } = useI18n();

  const asc = sort.direction === "asc";

  const directionLabel = asc
    ? t("sorting.switchToDescending")
    : t("sorting.switchToAscending");

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Select
        value={sort.field}
        onChange={(event) =>
          onChange({ field: event.target.value as F, direction: "asc" })
        }
        disabled={disabled}
        aria-label={t("sorting.field")}
        className={selectClassName}
        wrapperClassName="min-w-0 flex-1"
      >
        {options.map((option) => (
          <option key={option.field} value={option.field}>
            {option.label}
          </option>
        ))}
      </Select>

      <button
        type="button"
        onClick={() =>
          onChange({ field: sort.field, direction: asc ? "desc" : "asc" })
        }
        disabled={disabled}
        aria-label={directionLabel}
        title={directionLabel}
        className={cn(
          "btn-secondary h-10 w-10 flex-shrink-0 justify-center p-0",
          buttonClassName,
        )}
      >
        {asc ? (
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
