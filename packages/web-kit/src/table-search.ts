import type { PaginationState, SortingState } from "@mosaik/table"
import { type Accessor, createMemo } from "solid-js"

export type SortDirection = "asc" | "desc"

/** URL search params of a server-side table. Filters are any additional keys. */
export interface TableSearch<Sort extends string = string> {
  readonly page?: number | undefined
  readonly pageSize?: number | undefined
  readonly sort?: Sort | undefined
  readonly direction?: SortDirection | undefined
}

export interface TableSearchDefaults<Sort extends string> {
  readonly page: number
  readonly pageSize: number
  readonly sort: Sort
  readonly direction: SortDirection
}

/** The sort fields a table's search params allow. */
type SortOf<S extends TableSearch> = NonNullable<S["sort"]>

export interface TableSearchOptions<S extends TableSearch> {
  /** `Route.useSearch()`, assigned to a variable first so TypeScript infers the search type. */
  readonly search: Accessor<S>
  /** Writes the URL, e.g. `(update, { replace }) => navigate({ search: update, replace })`. */
  readonly navigate: (update: (previous: NoInfer<S>) => NoInfer<S>, options: { readonly replace: boolean }) => void
  readonly defaults: TableSearchDefaults<SortOf<NoInfer<S>>>
  /** Column ids that may be sent to the API as sort fields. */
  readonly sortable: ReadonlyArray<SortOf<NoInfer<S>>>
}

/**
 * Keeps a server-side table's pagination, sorting and filters in the URL, so views
 * are shareable, survive reloads and work with back/forward. Pair it with
 * `stripSearchParams(defaults)` on the route to keep URLs short.
 */
export const useTableSearch = <S extends TableSearch>(options: TableSearchOptions<S>) => {
  /** Search params with defaults applied: what the API query should use. */
  const params = createMemo(() => ({ ...options.defaults, ...options.search() }) as S & TableSearchDefaults<SortOf<S>>)

  const pagination = createMemo<PaginationState>(() => ({ pageIndex: params().page, pageSize: params().pageSize }))
  const sorting = createMemo<SortingState>(() => [{ id: params().sort, desc: params().direction === "desc" }])

  // Discrete changes add a history entry, so the back button undoes them.
  const push = { replace: false }

  const setPagination = (next: PaginationState) =>
    options.navigate(
      (previous) => ({
        ...previous,
        page: next.pageIndex,
        // A different page size invalidates the current page.
        ...(next.pageSize !== params().pageSize ? { page: 0, pageSize: next.pageSize } : {}),
      }),
      push,
    )

  const setSorting = (next: SortingState) => {
    const [first] = next
    const sort = options.sortable.find((field) => field === first?.id)
    options.navigate(
      (previous) => ({
        ...previous,
        page: 0,
        sort: sort ?? options.defaults.sort,
        direction: sort === undefined ? options.defaults.direction : first?.desc ? "desc" : "asc",
      }),
      push,
    )
  }

  /**
   * Updates filters and goes back to the first page. `undefined` removes a filter.
   * Pass `{ replace: true }` for continuous input (e.g. a search box) to avoid flooding history.
   */
  const setFilters = (filters: Partial<Omit<S, keyof TableSearch>>, navigation = push) =>
    options.navigate((previous) => ({ ...previous, ...filters, page: 0 }), navigation)

  return { params, pagination, sorting, setPagination, setSorting, setFilters }
}
