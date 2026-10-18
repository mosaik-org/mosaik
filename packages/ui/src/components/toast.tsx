import { Toaster as ArkToaster, createToaster, Toast } from "@ark-ui/solid/toast"
import { sva } from "@mosaik/styled-system/css"
import CircleCheck from "lucide-solid/icons/circle-check"
import CircleX from "lucide-solid/icons/circle-x"
import Info from "lucide-solid/icons/info"
import X from "lucide-solid/icons/x"
import { Match, Show, Switch } from "solid-js"

export const toaster = createToaster({ placement: "bottom-end", overlap: true, gap: 12 })

const toastStyles = sva({
  slots: ["root", "icon", "text", "title", "description", "close"],
  base: {
    root: {
      position: "relative",
      display: "flex",
      alignItems: "flex-start",
      gap: "3",
      w: "sm",
      maxW: "calc(100vw - 2rem)",
      p: "4",
      pe: "10",
      bg: "bg.surface",
      color: "fg.default",
      borderRadius: "card",
      boxShadow: "popover",
      height: "var(--height)",
      opacity: "var(--opacity)",
      translate: "var(--x) var(--y)",
      scale: "var(--scale)",
      zIndex: "var(--z-index)",
      overflowWrap: "anywhere",
      willChange: "translate, opacity, scale",
      transitionProperty: "translate, scale, opacity, height",
      transitionDuration: "400ms",
      transitionTimingFunction: "cubic-bezier(0.21, 1.02, 0.73, 1)",
      _closed: {
        transitionDuration: "200ms",
        transitionTimingFunction: "cubic-bezier(0.06, 0.71, 0.55, 1)",
      },
    },
    icon: {
      display: "flex",
      flexShrink: "0",
      mt: "0.5",
      "& svg": { boxSize: "4" },
      "[data-type=success] &": { color: "success.default" },
      "[data-type=error] &": { color: "danger.default" },
      "[data-type=info] &": { color: "accent.default" },
    },
    text: { display: "flex", flexDirection: "column", gap: "0.5", minW: "0" },
    title: { fontSize: "sm", fontWeight: "semibold" },
    description: { fontSize: "sm", color: "fg.muted" },
    close: {
      position: "absolute",
      top: "3",
      insetEnd: "3",
      display: "flex",
      p: "1",
      color: "fg.subtle",
      borderRadius: "sm",
      cursor: "pointer",
      _hover: { color: "fg.default", bg: "bg.muted" },
      _focusVisible: { outline: "2px solid", outlineColor: "accent.default" },
      "& svg": { boxSize: "3.5" },
    },
  },
})

export function Toaster() {
  const classes = toastStyles()

  return (
    <ArkToaster toaster={toaster}>
      {(current) => (
        <Toast.Root class={classes.root}>
          <span class={classes.icon} aria-hidden="true">
            <Switch>
              <Match when={current().type === "success"}>
                <CircleCheck />
              </Match>
              <Match when={current().type === "error"}>
                <CircleX />
              </Match>
              <Match when={current().type === "info"}>
                <Info />
              </Match>
            </Switch>
          </span>
          <div class={classes.text}>
            <Toast.Title class={classes.title}>{current().title}</Toast.Title>
            <Show when={current().description}>
              {(description) => <Toast.Description class={classes.description}>{description()}</Toast.Description>}
            </Show>
          </div>
          <Toast.CloseTrigger class={classes.close} aria-label="Dismiss notification">
            <X />
          </Toast.CloseTrigger>
        </Toast.Root>
      )}
    </ArkToaster>
  )
}

export const toast = {
  success: (title: string, description?: string) => toaster.create({ type: "success", title, description }),
  error: (title: string, description?: string) => toaster.create({ type: "error", title, description }),
  info: (title: string, description?: string) => toaster.create({ type: "info", title, description }),
}
