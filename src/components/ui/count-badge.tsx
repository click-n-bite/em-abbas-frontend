/** Small count shown beside a page title. */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="ms-2 inline-block rounded-full bg-ink-100 px-2 py-0.5 align-middle text-xs font-medium tabular-nums text-ink-600 dark:bg-ink-700 dark:text-ink-200">
      {count.toLocaleString("en-US")}
    </span>
  );
}
