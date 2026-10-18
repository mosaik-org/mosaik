import { css, cva } from "@mosaik/styled-system/css"
import { Skeleton } from "@mosaik/ui"
import {
  createTable,
  functionalUpdate,
  type PaginationState,
  type Row,
  type RowData,
  type SortingState,
  type Updater,
} from "@tanstack/solid-table"
import { createSignal, For, Index, mergeProps, Show } from "solid-js"
import { cellRecipe, DataTableHeaderCell } from "./data-table-header-cell"
import { DataTablePagination } from "./data-table-pagination"
import { type DataTableColumns, type DataTableFeatures, dataTableFeatures } from "./features"

const DEFAULT_PAGE_SIZE = 20
const SKELETON_ROW_COUNT = 5

const styles = {
  root: css({
    display: "flex",
    flexDirection: "column",
    minW: "0",
    bg: "bg.surface",
    borderWidth: "1px",
    borderColor: "border.default",
    borderRadius: "card",
    boxShadow: "card",
    overflow: "hidden",
  }),
  scroller: css({ overflowX: "auto" }),
  table: css({ w: "full", borderCollapse: "collapse", fontSize: "sm" }),
  body: css({
    transition: "opacity 150ms",
    "&[aria-busy=true]": { opacity: "0.6" },
  }),
  empty: css({ py: "10", textAlign: "center", color: "fg.muted" }),
}

const rowRecipe = cva({
  base: {
    borderBottomWidth: "1px",
    borderColor: "border.default",
    _last: { borderBottomWidth: "0" },
    _even: { bg: "bg.muted/40", _hover: { bg: "bg.muted" } },
    _hover: { bg: "bg.muted" },
  },
  variants: {
    clickable: {
      true: {
        cursor: "pointer",
        outline: "none",
        _focusVisible: { bg: "bg.muted", boxShadow: "inset 2px 0 0 {colors.accent.default}" },
      },
    },
  },
})

interface DataTableBaseProps<TData extends RowData> {
  columns: DataTableColumns<TData>
  data: ReadonlyArray<TData>
  getRowId?: (row: TData) => string
  loading?: boolean
  emptyMessage?: string
  pageSizes?: number[]
  onRowClick?: (row: TData) => void
}

export interface DataTableClientProps {
  manual?: false
}

export interface DataTableManualProps {
  manual: true
  rowCount: number
  pagination: PaginationState
  onPaginationChange: (state: PaginationState) => void
  sorting: SortingState
  onSortingChange: (state: SortingState) => void
}

export type DataTableProps<TData extends RowData> = DataTableBaseProps<TData> &
  (DataTableClientProps | DataTableManualProps)

export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  const merged = mergeProps({ emptyMessage: "No results", pageSizes: [10, 20, 50, 100] }, props)

  const [localSorting, setLocalSorting] = createSignal<SortingState>([])
  const [localPagination, setLocalPagination] = createSignal<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const sorting = () => (props.manual ? props.sorting : localSorting())
  const pagination = () => (props.manual ? props.pagination : localPagination())

  const updateSorting = (updater: Updater<SortingState>) => {
    const next = functionalUpdate(updater, sorting())
    if (!props.manual) return setLocalSorting(next)
    props.onSortingChange(next)
    if (props.pagination.pageIndex !== 0) props.onPaginationChange({ ...props.pagination, pageIndex: 0 })
  }

  const updatePagination = (updater: Updater<PaginationState>) => {
    const next = functionalUpdate(updater, pagination())
    if (props.manual) props.onPaginationChange(next)
    else setLocalPagination(next)
  }

  const table = createTable<DataTableFeatures, TData>({
    features: dataTableFeatures,
    get columns() {
      return props.columns
    },
    get data() {
      return props.data
    },
    getRowId: (row, index) => props.getRowId?.(row) ?? String(index),
    get manualSorting() {
      return props.manual === true
    },
    get manualPagination() {
      return props.manual === true
    },
    get rowCount() {
      return props.manual ? props.rowCount : undefined
    },
    state: {
      get sorting() {
        return sorting()
      },
      get pagination() {
        return pagination()
      },
    },
    onSortingChange: updateSorting,
    onPaginationChange: updatePagination,
  })

  const rows = () => table.getRowModel().rows
  const leafColumnCount = () => table.getAllLeafColumns().length
  const showSkeleton = () => Boolean(props.loading) && props.data.length === 0

  const handleRowKeyDown = (event: KeyboardEvent, row: Row<DataTableFeatures, TData>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    props.onRowClick?.(row.original)
  }

  return (
    <div class={styles.root}>
      <div class={styles.scroller}>
        <table class={styles.table}>
          <thead>
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <tr>
                  <For each={headerGroup.headers}>
                    {(header) => (
                      <DataTableHeaderCell header={header}>
                        <table.FlexRender header={header} />
                      </DataTableHeaderCell>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody class={styles.body} aria-busy={props.loading ? "true" : undefined}>
            <Show
              when={!showSkeleton()}
              fallback={
                <Index each={Array.from({ length: SKELETON_ROW_COUNT })}>
                  {() => (
                    <tr class={rowRecipe()}>
                      <Index each={table.getAllLeafColumns()}>
                        {() => (
                          <td class={cellRecipe()}>
                            <Skeleton height="1rem" />
                          </td>
                        )}
                      </Index>
                    </tr>
                  )}
                </Index>
              }
            >
              <For
                each={rows()}
                fallback={
                  <tr>
                    <td class={styles.empty} colSpan={leafColumnCount()}>
                      {merged.emptyMessage}
                    </td>
                  </tr>
                }
              >
                {(row) => (
                  <tr
                    class={rowRecipe({ clickable: Boolean(props.onRowClick) })}
                    tabIndex={props.onRowClick ? 0 : undefined}
                    onClick={() => props.onRowClick?.(row.original)}
                    onKeyDown={(event) => handleRowKeyDown(event, row)}
                  >
                    <For each={row.getAllCells()}>
                      {(cell) => (
                        <td
                          class={cellRecipe({ align: cell.column.columnDef.meta?.align })}
                          style={{ width: cell.column.columnDef.meta?.width }}
                        >
                          <table.FlexRender cell={cell} />
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>
      <DataTablePagination table={table} pageSizes={merged.pageSizes} />
    </div>
  )
}
