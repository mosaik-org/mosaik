import { Tooltip as ArkTooltip, type TooltipRootProps } from "@ark-ui/solid/tooltip"
import { css } from "@mosaik/styled-system/css"
import type { JSX } from "solid-js"
import { Portal } from "solid-js/web"

type Placement = NonNullable<NonNullable<TooltipRootProps["positioning"]>["placement"]>

const styles = {
  trigger: css({ display: "inline-flex" }),
  content: css({
    maxW: "xs",
    px: "2",
    py: "1",
    bg: "fg.default",
    color: "fg.inverted",
    fontSize: "xs",
    fontWeight: "medium",
    borderRadius: "sm",
    boxShadow: "popover",
    zIndex: "60",
    _open: { animation: "fadeIn 100ms ease-out" },
    _closed: { animation: "fadeOut 75ms ease-in" },
  }),
}

export interface TooltipProps {
  content: JSX.Element
  children: JSX.Element
  placement?: Placement
}

export function Tooltip(props: TooltipProps) {
  return (
    <ArkTooltip.Root
      openDelay={300}
      closeDelay={100}
      positioning={{ placement: props.placement ?? "top" }}
      lazyMount
      unmountOnExit
    >
      <ArkTooltip.Trigger
        asChild={(triggerProps) => (
          <span {...triggerProps()} class={styles.trigger}>
            {props.children}
          </span>
        )}
      />
      <Portal>
        <ArkTooltip.Positioner>
          <ArkTooltip.Content class={styles.content}>{props.content}</ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  )
}
