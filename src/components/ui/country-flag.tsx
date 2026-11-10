import { cn } from "@/lib/utils";

interface Props {
  code: string;
  className?: string;
}

export function CountryFlag({ code, className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "fi inline-block rounded-[2px] bg-ink-100 align-middle dark:bg-ink-700",
        `fi-${code.toLowerCase()}`,
        className,
      )}
    />
  );
}
