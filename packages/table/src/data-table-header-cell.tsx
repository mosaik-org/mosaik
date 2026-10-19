import { cva } from "@mosaik/styled-system/css"
import type { Header, RowData } from "@tanstack/solid-table"
import ArrowDown from "lucide-solid/icons/arrow-down"
import ArrowUp from "lucide-solid/icons/arrow-up"
import ChevronsUpDown from "lucide-solid/icons/chevrons-up-down"
import { type JSX, Match, Show, Switch } from "solid-js"
import type { DataTableFeatures } from "./features"

export const cellRecipe = cva({
  base: {
    px: "4",
    textAlign: "start",
    whiteSpace: "nowrap",
  },
  variants: {
    kind: {
      header: {
        h: "10",
        bg: "gray.2",
        color: "fg.muted",
        fontSize: "xs",
        fontWeight: "medium",
        textTransform: "uppercase",
        letterSpacing: "wider",
        borderBottomWidth: "1px",
        borderColor: "border",
      },
      body: { py: "2.5", color: "fg.default" },
    },
    align: {
      left: { textAlign: "start" },
      center: { textAlign: "center" },
      right: { textAlign: "end", fontVariantNumeric: "tabular-nums" },
    },
  },
  defaultVariants: { kind: "body", align: "left" },
})

const sortButton = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    mx: "-1",
    px: "1",
    py: "0.5",
    color: "inherit",
    fontSize: "inherit",
    fontWeight: "inherit",
    textTransform: "inherit",
    letterSpacing: "inherit",
    borderRadius: "sm",
    cursor: "pointer",
    outline: "none",
    _hover: { color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg" },
    "& svg": { boxSize: "3.5", flexShrink: "0" },
  },
  variants: {
    align: {
      left: {},
      center: {},
      right: { flexDirection: "row-reverse" },
    },
    sorted: {
      true: { color: "fg.default" },
      false: { "& svg": { opacity: "0.5" } },
    },
  },
})

export interface DataTableHeaderCellProps<TData extends RowData> {
  header: Header<DataTableFeatures, TData, unknown>
  children: JSX.Element
}

export function DataTableHeaderCell<TData extends RowData>(props: DataTableHeaderCellProps<TData>) {
  const column = () => props.header.column
  const meta = () => column().columnDef.meta
  const sorted = () => column().getIsSorted()

  const ariaSort = () => {
    if (!column().getCanSort()) return undefined
    const direction = sorted()
    if (direction === "asc") return "ascending"
    if (direction === "desc") return "descending"
    return "none"
  }

  return (
    <th
      scope="col"
      colSpan={props.header.colSpan}
      class={cellRecipe({ kind: "header", align: meta()?.align })}
      style={{ width: meta()?.width }}
      aria-sort={ariaSort()}
    >
      <Show when={!props.header.isPlaceholder}>
        <Show when={column().getCanSort()} fallback={props.children}>
          <button
            type="button"
            class={sortButton({ align: meta()?.align ?? "left", sorted: sorted() !== false })}
            onClick={(event) => column().getToggleSortingHandler()?.(event)}
          >
            {props.children}
            <Switch fallback={<ChevronsUpDown aria-hidden="true" />}>
              <Match when={sorted() === "asc"}>
                <ArrowUp aria-hidden="true" />
              </Match>
              <Match when={sorted() === "desc"}>
                <ArrowDown aria-hidden="true" />
              </Match>
            </Switch>
          </button>
        </Show>
      </Show>
    </th>
  )
}
