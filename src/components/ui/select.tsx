import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
  mobileLabel?: string;
}

export function Select({
  children,
  className,
  wrapperClassName,
  mobileLabel,
  ...props
}: Props) {
  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <select
        {...props}
        className={cn(
          "input appearance-none pe-10",
          mobileLabel &&
            "max-lg:!text-transparent max-lg:[&>option]:text-ink-900 dark:max-lg:[&>option]:text-ink-100",
          className,
        )}
      >
        {children}
      </select>
      {mobileLabel ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-2 end-8 flex items-center break-words text-sm leading-4 text-ink-900 dark:text-ink-100 lg:hidden"
        >
          {mobileLabel}
        </span>
      ) : null}
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
    </div>
  );
}
