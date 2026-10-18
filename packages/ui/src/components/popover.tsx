import { Popover as ArkPopover } from "@ark-ui/solid/popover"
import { css, cx } from "@mosaik/styled-system/css"
import type { JSX } from "solid-js"
import { Portal } from "solid-js/web"

const content = css({
  display: "flex",
  flexDirection: "column",
  w: "var(--popover-width)",
  maxW: "calc(100vw - 2rem)",
  maxH: "min(var(--available-height, 480px), 480px)",
  bg: "bg.surface",
  color: "fg.default",
  borderRadius: "card",
  boxShadow: "popover",
  outline: "none",
  overflow: "hidden",
  zIndex: "50",
  transformOrigin: "var(--transform-origin)",
  _open: { animation: "scaleIn 120ms ease-out" },
  _closed: { animation: "scaleOut 100ms ease-in" },
})

export interface PopoverProps {
  trigger: (props: Record<string, unknown>) => JSX.Element
  open: boolean
  onOpenChange: (open: boolean) => void
  /** CSS width of the panel. Defaults to 22rem. */
  width?: string
  /** Accessible name of the panel. */
  label: string
  class?: string
  children: JSX.Element
}

/** A panel anchored to a trigger (e.g. a notifications list), closed on outside click or Escape. */
export function Popover(props: PopoverProps) {
  return (
    <ArkPopover.Root
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      positioning={{ placement: "bottom-end", gutter: 8 }}
      lazyMount
      unmountOnExit
    >
      <ArkPopover.Trigger asChild={(triggerProps) => props.trigger(triggerProps() as Record<string, unknown>)} />
      <Portal>
        <ArkPopover.Positioner>
          <ArkPopover.Content
            class={cx(content, props.class)}
            style={{ "--popover-width": props.width ?? "22rem" }}
            aria-label={props.label}
          >
            {props.children}
          </ArkPopover.Content>
        </ArkPopover.Positioner>
      </Portal>
    </ArkPopover.Root>
  )
}
