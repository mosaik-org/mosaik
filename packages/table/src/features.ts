import {
  type ColumnDef,
  createColumnHelper as createBaseColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/solid-table"

export interface DataTableColumnMeta {
  align?: "left" | "right" | "center"
  width?: string
}

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
})

export type DataTableFeatures = typeof dataTableFeatures

export type DataTableColumns<TData extends RowData> = ReadonlyArray<ColumnDef<DataTableFeatures, TData, any>>

export const createColumnHelper = <TData extends RowData>() => createBaseColumnHelper<DataTableFeatures, TData>()
