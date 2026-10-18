import { Tabs as ArkTabs } from "@ark-ui/solid/tabs"
import { sva } from "@mosaik/styled-system/css"
import { For, type JSX } from "solid-js"

const tabs = sva({
  slots: ["root", "list", "trigger", "indicator"],
  base: {
    root: { w: "full" },
    list: {
      position: "relative",
      display: "flex",
      gap: "1",
      borderBottomWidth: "1px",
      borderColor: "border.default",
      overflowX: "auto",
      scrollbarWidth: "none",
    },
    trigger: {
      display: "inline-flex",
      alignItems: "center",
      gap: "2",
      h: "9",
      px: "3",
      fontSize: "sm",
      fontWeight: "medium",
      color: "fg.muted",
      whiteSpace: "nowrap",
      cursor: "pointer",
      outline: "none",
      borderRadius: "control",
      transition: "color 150ms",
      _hover: { color: "fg.default" },
      _selected: { color: "fg.default" },
      _focusVisible: { outline: "2px solid", outlineColor: "accent.default", outlineOffset: "-2px" },
      _disabled: { opacity: "0.5", cursor: "not-allowed" },
    },
    indicator: {
      bottom: "-1px",
      h: "2px",
      w: "var(--width)",
      bg: "accent.default",
      borderRadius: "full",
    },
  },
})

export interface TabItem {
  value: string
  label: JSX.Element
  disabled?: boolean
}

export interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  items: ReadonlyArray<TabItem>
}

export function Tabs(props: TabsProps) {
  const classes = tabs()

  return (
    <ArkTabs.Root
      class={classes.root}
      value={props.value}
      onValueChange={(details) => props.onValueChange(details.value)}
    >
      <ArkTabs.List class={classes.list}>
        <For each={props.items}>
          {(item) => (
            <ArkTabs.Trigger class={classes.trigger} value={item.value} disabled={item.disabled}>
              {item.label}
            </ArkTabs.Trigger>
          )}
        </For>
        <ArkTabs.Indicator class={classes.indicator} />
      </ArkTabs.List>
    </ArkTabs.Root>
  )
}
