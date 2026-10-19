import { IconButton, SelectField } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
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
    borderColor: "border",
    fontSize: "sm",
    color: "fg.muted",
  }),
  summary: css({ fontVariantNumeric: "tabular-nums" }),
  controls: css({ display: "flex", alignItems: "center", gap: "2" }),
  // The field's label beside its select, not above it.
  pageSize: css({
    flexDirection: "row",
    alignItems: "center",
    gap: "2",
    whiteSpace: "nowrap",
    "& [data-part=root]": { w: "20" },
  }),
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
        <SelectField
          label="Rows per page"
          class={styles.pageSize}
          size="sm"
          items={pageSizeItems()}
          value={String(pagination().pageSize)}
          onValueChange={(value) => props.table.setPageSize(Number(value))}
        />
        <div class={styles.nav}>
          <IconButton
            aria-label="Previous page"
            size="xs"
            variant="outline"
            disabled={!props.table.getCanPreviousPage()}
            onClick={() => props.table.previousPage()}
          >
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton
            aria-label="Next page"
            size="xs"
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
