import { css } from "@mosaik/styled-system/css"
import { Link } from "@tanstack/solid-router"
import { For } from "solid-js"

export interface NavTabItem {
  readonly to: string
  readonly label: string
  /** Only active on an exact path match (use for index routes). */
  readonly exact?: boolean
}

const list = css({
  display: "flex",
  gap: "1",
  borderBottomWidth: "1px",
  overflowX: "auto",
})

const tab = css({
  position: "relative",
  px: "3",
  py: "2",
  fontSize: "sm",
  fontWeight: "medium",
  color: "fg.muted",
  whiteSpace: "nowrap",
  transition: "color 0.15s",
  _hover: { color: "fg" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent.solid", outlineOffset: "-2px", borderRadius: "sm" },
  "&[data-status=active]": {
    color: "fg",
    _after: {
      content: '""',
      position: "absolute",
      insetX: "2",
      bottom: "-1px",
      height: "2px",
      borderRadius: "full",
      bg: "fg",
    },
  },
})

/** Router-aware tab navigation for app sub-pages. */
export const NavTabs = (props: { items: ReadonlyArray<NavTabItem> }) => (
  <nav class={list} aria-label="App sections">
    <For each={props.items}>
      {(item) => (
        <Link to={item.to} class={tab} activeOptions={{ exact: item.exact ?? false }}>
          {item.label}
        </Link>
      )}
    </For>
  </nav>
)
