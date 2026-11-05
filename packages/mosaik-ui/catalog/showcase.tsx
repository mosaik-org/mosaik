import { For, type JSX } from "solid-js"
import { css } from "styled-system/css"

/** Every color a component can take: the roles first, then each palette. */
export const COLORS = [
  "gray",
  "accent",
  "danger",
  "success",
  "warning",
  "amber",
  "blue",
  "green",
  "indigo",
  "neutral",
  "orange",
  "pink",
  "red",
  "slate",
  "teal",
  "violet",
] as const

const SCALE = ["inherit", "2xs", "xs", "sm", "md", "lg", "xl", "2xl"]

/** Sizes smallest first: a recipe lists its values alphabetically (`lg`, `md`, `sm`). */
export const bySize = <T extends string>(sizes: ReadonlyArray<T>): ReadonlyArray<T> =>
  sizes.toSorted((a, b) => SCALE.indexOf(a) - SCALE.indexOf(b))

const styles = {
  grid: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))",
    gap: "5",
    alignItems: "start",
  }),
  rows: css({ display: "flex", flexDirection: "column", gap: "5" }),
  cell: css({ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2", minW: "0" }),
  wide: css({ alignItems: "stretch" }),
  caption: css({ fontFamily: "mono", textStyle: "xs", color: "fg.subtle" }),
  // Positioned, so that what is out of sight inside (a hidden label) scrolls with it.
  table: css({ position: "relative", display: "grid", gap: "3", alignItems: "center", overflowX: "auto", pb: "1" }),
}

/**
 * Each value of a variant, a size or a color, named: examples read the values from the recipe
 * (`button.variantMap.size`), so whatever a recipe gains shows up here. `wide` is for what fills
 * its width (a progress bar) and gets a row each.
 */
export const Showcase = <T extends string | boolean>(props: {
  readonly values: ReadonlyArray<T>
  readonly wide?: boolean
  readonly children: (value: T) => JSX.Element
}) => (
  <div class={props.wide ? styles.rows : styles.grid}>
    <For each={props.values}>
      {(value) => (
        <div class={props.wide ? `${styles.cell} ${styles.wide}` : styles.cell}>
          <span class={styles.caption}>{String(value)}</span>
          {props.children(value)}
        </div>
      )}
    </For>
  </div>
)

/** Two lists at once, such as every variant in every color. */
export const Matrix = <R extends string, C extends string>(props: {
  readonly rows: ReadonlyArray<R>
  readonly columns: ReadonlyArray<C>
  readonly children: (row: R, column: C) => JSX.Element
}) => (
  <div
    class={styles.table}
    style={{ "grid-template-columns": `max-content repeat(${props.columns.length}, max-content)` }}
  >
    <span />
    <For each={props.columns}>{(column) => <span class={styles.caption}>{column}</span>}</For>
    <For each={props.rows}>
      {(row) => (
        <>
          <span class={styles.caption}>{row}</span>
          <For each={props.columns}>{(column) => <div>{props.children(row, column)}</div>}</For>
        </>
      )}
    </For>
  </div>
)
