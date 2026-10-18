import { Dialog as ArkDialog } from "@ark-ui/solid/dialog"
import { sva } from "@mosaik/styled-system/css"
import X from "lucide-solid/icons/x"
import { children, createMemo, type JSX, mergeProps, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { IconButton } from "./icon-button"

const dialog = sva({
  slots: ["backdrop", "positioner", "content", "header", "title", "description", "close", "body", "footer"],
  base: {
    backdrop: {
      position: "fixed",
      inset: "0",
      zIndex: "100",
      bg: "bg.overlay",
      backdropFilter: "blur(2px)",
      _open: { animation: "fadeIn 150ms ease-out" },
      _closed: { animation: "fadeOut 120ms ease-in" },
    },
    positioner: {
      position: "fixed",
      inset: "0",
      zIndex: "100",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      px: "4",
      py: { base: "4", sm: "12vh" },
    },
    content: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      w: "full",
      maxH: { base: "calc(100dvh - 2rem)", sm: "76vh" },
      bg: "bg.surface",
      color: "fg.default",
      borderRadius: "card",
      boxShadow: "popover",
      outline: "none",
      _open: { animation: "scaleIn 150ms ease-out" },
      _closed: { animation: "scaleOut 120ms ease-in" },
    },
    header: { display: "flex", flexDirection: "column", gap: "1", p: "5", pe: "12" },
    title: { fontSize: "lg", fontWeight: "semibold", lineHeight: "tight" },
    description: { fontSize: "sm", color: "fg.muted" },
    close: { position: "absolute", top: "3", insetEnd: "3" },
    body: { px: "5", pb: "5", overflowY: "auto", minH: "0" },
    footer: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "2",
      px: "5",
      py: "4",
      borderTopWidth: "1px",
      borderColor: "border.default",
      bg: "bg.subtle",
      borderBottomRadius: "card",
    },
  },
  variants: {
    size: {
      sm: { content: { maxW: "sm" } },
      md: { content: { maxW: "lg" } },
      lg: { content: { maxW: "3xl" } },
    },
  },
  defaultVariants: { size: "md" },
})

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: JSX.Element
  description?: JSX.Element
  children?: JSX.Element
  footer?: JSX.Element
  size?: "sm" | "md" | "lg"
}

export function Dialog(props: DialogProps) {
  const merged = mergeProps({ size: "md" as const }, props)
  const classes = createMemo(() => dialog({ size: merged.size }))
  const body = children(() => merged.children)

  return (
    <ArkDialog.Root
      open={merged.open}
      onOpenChange={(details) => merged.onOpenChange(details.open)}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <ArkDialog.Backdrop class={classes().backdrop} />
        <ArkDialog.Positioner class={classes().positioner}>
          <ArkDialog.Content class={classes().content}>
            <div class={classes().header}>
              <ArkDialog.Title class={classes().title}>{merged.title}</ArkDialog.Title>
              <Show when={merged.description}>
                {(description) => (
                  <ArkDialog.Description class={classes().description}>{description()}</ArkDialog.Description>
                )}
              </Show>
            </div>
            <ArkDialog.CloseTrigger
              asChild={(triggerProps) => (
                <IconButton {...triggerProps()} class={classes().close} label="Close" size="sm">
                  <X size={16} />
                </IconButton>
              )}
            />
            <Show when={body()}>
              <div class={classes().body}>{body()}</div>
            </Show>
            <Show when={merged.footer}>{(footer) => <div class={classes().footer}>{footer()}</div>}</Show>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  )
}
