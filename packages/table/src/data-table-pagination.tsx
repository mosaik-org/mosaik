import { css } from "@mosaik/styled-system/css"
import { createListCollection, IconButton, Select } from "@mosaik/ui"
import type { RowData, SolidTable } from "@tanstack/solid-table"
import ChevronLeft from "lucide-solid/icons/chevron-left"
import ChevronRight from "lucide-solid/icons/chevron-right"
import { createMemo, For } from "solid-js"
import { Portal } from "solid-js/web"
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
  // The label beside its select, not above it, in the bar's quieter text.
  pageSize: css({
    flexDirection: "row",
    alignItems: "center",
    gap: "2",
    whiteSpace: "nowrap",
    "& [data-part=label]": { fontWeight: "normal", color: "inherit" },
    "& [data-part=control]": { width: "20" },
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

  const pageSizes = createMemo(() => createListCollection({ items: props.pageSizes.map(String) }))

  return (
    <div class={styles.root}>
      <span class={styles.summary} aria-live="polite">
        {summary()}
      </span>
      <div class={styles.controls}>
        {/* Its parts rather than a SelectField: the list goes in a portal, out of the table's frame,
            which clips what overflows it. */}
        <Select.Root
          class={styles.pageSize}
          size="sm"
          collection={pageSizes()}
          value={[String(pagination().pageSize)]}
          onValueChange={(details) => props.table.setPageSize(Number(details.value[0]))}
        >
          <Select.Label>Rows per page</Select.Label>
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText />
              <Select.Indicator />
            </Select.Trigger>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                <For each={pageSizes().items}>
                  {(size) => (
                    <Select.Item item={size}>
                      <Select.ItemText>{size}</Select.ItemText>
                      <Select.ItemIndicator />
                    </Select.Item>
                  )}
                </For>
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>
        <div class={styles.nav}>
          <IconButton
            aria-label="Previous page"
            size="sm"
            variant="outline"
            disabled={!props.table.getCanPreviousPage()}
            onClick={() => props.table.previousPage()}
          >
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton
            aria-label="Next page"
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
