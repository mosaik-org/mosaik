import { For } from "solid-js"
import { css } from "styled-system/css"
import { palettes } from "../src/theme/colors"
import { COLORS } from "./showcase"

export const COLOR_PAGE = "colors"

const STEPS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]

const ROLES: ReadonlyArray<readonly [string, string]> = [
  ["accent", "Primary actions, focus, selection"],
  ["gray", "Surfaces, borders and text"],
  ["danger", "Failures and what cannot be undone"],
  ["success", "What went well"],
  ["warning", "What needs care"],
]

const styles = {
  heading: css({ textStyle: "3xl", fontWeight: "semibold", letterSpacing: "-0.01em" }),
  lead: css({ color: "fg.muted", textStyle: "sm", mt: "2", maxW: "2xl" }),
  section: css({ display: "flex", flexDirection: "column", gap: "4" }),
  title: css({ textStyle: "lg", fontWeight: "semibold" }),
  rows: css({ display: "flex", flexDirection: "column", gap: "3" }),
  row: css({
    display: "grid",
    gridTemplateColumns: { base: "1fr", sm: "7rem minmax(0, 1fr)" },
    alignItems: "center",
    gap: "2",
  }),
  name: css({ fontFamily: "mono", textStyle: "xs", color: "fg.muted" }),
  note: css({ display: "block", textStyle: "xs", color: "fg.subtle", mt: "0.5" }),
  scale: css({ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: "1" }),
  step: css({
    display: "grid",
    placeItems: "center",
    h: "9",
    borderRadius: "l1",
    textStyle: "xs",
    boxShadow: "inset 0 0 0 1px token(colors.black.a2)",
  }),
  uses: css({ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))", gap: "2", flex: "1" }),
  use: css({
    display: "grid",
    placeItems: "center",
    h: "9",
    borderRadius: "l2",
    textStyle: "xs",
    borderWidth: "1px",
    borderColor: "transparent",
  }),
}

const Scale = (props: { readonly name: string }) => (
  <div class={styles.scale}>
    <For each={STEPS}>
      {(step, index) => (
        <div
          class={styles.step}
          style={{
            background: `var(--mk-colors-${props.name}-${step})`,
            // From the palette's other end, which reads in either theme, and on its fill as its text does.
            color: `var(--mk-colors-${props.name}-${index() < 8 ? "12" : index() < 10 ? "solid-fg" : "1"})`,
          }}
          title={`${props.name}.${step}`}
        >
          {step}
        </div>
      )}
    </For>
  </div>
)

const USES: ReadonlyArray<readonly [string, string, string?]> = [
  ["solid", "solid.bg"],
  ["subtle", "subtle.bg"],
  ["surface", "surface.bg", "surface.border"],
  ["outline", "transparent", "outline.border"],
  ["plain", "transparent"],
]

const varOf = (palette: string, token: string) => `var(--mk-colors-${palette}-${token.replaceAll(".", "-")})`

/** What a component reads from a palette: its fill, its text and its border for each style. */
const Uses = (props: { readonly name: string }) => (
  <div class={styles.uses}>
    <For each={USES}>
      {([label, background, border]) => (
        <div
          class={styles.use}
          style={{
            background: background === "transparent" ? "transparent" : varOf(props.name, background),
            color: varOf(props.name, `${label}.fg`),
            ...(border === undefined ? {} : { "border-color": varOf(props.name, border) }),
          }}
        >
          {label}
        </div>
      )}
    </For>
  </div>
)

/** The colors of the theme: what each role is for, and every palette's steps. */
export const Colors = () => (
  <>
    <header>
      <h1 class={styles.heading}>Colors</h1>
      <p class={styles.lead}>
        Components are grey unless they ask for more. Roles say what a color means and point at a palette; a palette is
        twelve steps, from the page's background to its strongest text.
      </p>
    </header>
    <section class={styles.section}>
      <h2 class={styles.title}>Roles</h2>
      <div class={styles.rows}>
        <For each={ROLES}>
          {([role, purpose]) => (
            <div class={styles.row}>
              <span>
                <span class={styles.name}>{role}</span>
                <span class={styles.note}>{purpose}</span>
              </span>
              <Uses name={role} />
            </div>
          )}
        </For>
      </div>
    </section>
    <section class={styles.section}>
      <h2 class={styles.title}>Palettes</h2>
      <div class={styles.rows}>
        <For each={COLORS.filter((color) => Object.hasOwn(palettes, color))}>
          {(name) => (
            <div class={styles.row}>
              <span class={styles.name}>{name}</span>
              <Scale name={name} />
            </div>
          )}
        </For>
      </div>
    </section>
  </>
)
