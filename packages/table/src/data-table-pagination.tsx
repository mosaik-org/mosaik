import { css } from "@mosaik/styled-system/css"
import { IconButton, Select } from "@mosaik/ui"
import type { RowData, SolidTable } from "@tanstack/solid-table"
import ChevronLeft from "lucide-solid/icons/chevron-left"
import ChevronRight from "lucide-solid/icons/chevron-right"
import { createMemo } from "solid-js"
import type { DataTableFeatures } from "./features"

const styles = {
  root: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "3",
    px: "4",
    py: "2.5",
    borderTopWidth: "1px",
    borderColor: "border.default",
    fontSize: "sm",
    color: "fg.muted",
  }),
  summary: css({ fontVariantNumeric: "tabular-nums" }),
  controls: css({ display: "flex", alignItems: "center", gap: "2" }),
  pageSizeLabel: css({ whiteSpace: "nowrap" }),
  pageSize: css({ w: "20" }),
  nav: css({ display: "flex", alignItems: "center", gap: "1" }),
}

const numberFormat = new Intl.NumberFormat()

export interface DataTablePaginationProps<TData extends RowData> {
  table: SolidTable<DataTableFeatures, TData>
  pageSizes: ReadonlyArray<number>
}

export function DataTablePagination<TData extends RowData>(props: DataTablePaginationProps<TData>) {
  const pagination = () => props.table.atoms.pagination.get()

  const summary = createMemo(() => {
    const total = props.table.getRowCount()
    if (total === 0) return "No results"
    const { pageIndex, pageSize } = pagination()
    const start = pageIndex * pageSize + 1
    // A page past the end (e.g. from a stale link) has no rows.
    if (start > total) return `No results on this page (${numberFormat.format(total)} total)`
    const end = Math.min(start + props.table.getRowModel().rows.length - 1, total)
    return `Showing ${numberFormat.format(start)}–${numberFormat.format(end)} of ${numberFormat.format(total)}`
  })

  const pageSizeItems = createMemo(() => props.pageSizes.map((size) => ({ value: String(size), label: String(size) })))

  return (
    <div class={styles.root}>
      <span class={styles.summary} aria-live="polite">
        {summary()}
      </span>
      <div class={styles.controls}>
        <span class={styles.pageSizeLabel} aria-hidden="true">
          Rows per page
        </span>
        <Select
          aria-label="Rows per page"
          class={styles.pageSize}
          size="sm"
          items={pageSizeItems()}
          value={String(pagination().pageSize)}
          onValueChange={(value) => props.table.setPageSize(Number(value))}
        />
        <div class={styles.nav}>
          <IconButton
            label="Previous page"
            size="sm"
            variant="outline"
            disabled={!props.table.getCanPreviousPage()}
            onClick={() => props.table.previousPage()}
          >
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton
            label="Next page"
            size="sm"
            variant="outline"
            disabled={!props.table.getCanNextPage()}
            onClick={() => props.table.nextPage()}
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
