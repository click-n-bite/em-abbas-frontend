export type SortDirection = "asc" | "desc";

export interface SortState<F extends string> {
  field: F;
  direction: SortDirection;
}

/**
 * Clicking an inactive field selects it ascending; clicking the active field
 * flips its direction. There is intentionally no third "unsorted" state.
 */
export function toggleSort<F extends string>(
  current: SortState<F>,
  field: F,
): SortState<F> {
  if (current.field !== field) return { field, direction: "asc" };

  return { field, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function sameSort<F extends string>(
  a: SortState<F>,
  b: SortState<F>,
): boolean {
  return a.field === b.field && a.direction === b.direction;
}

/** Appends `sort` and `direction` (always together) to a query string builder. */
export function appendSort<F extends string>(
  search: URLSearchParams,
  params: { sort?: F; direction?: SortDirection },
): void {
  if (params.sort) search.set("sort", params.sort);

  if (params.direction) search.set("direction", params.direction);
}
