import { type JSX, Show, splitProps } from "solid-js"
import { Portal } from "solid-js/web"
import type { DialogVariantProps } from "../../styled-system/recipes"
import { CloseButton } from "../components/close-button"
import * as Dialog from "../components/dialog"

export interface ModalProps extends DialogVariantProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: JSX.Element
  readonly description?: JSX.Element
  /** The buttons at the bottom, such as Cancel and Save. */
  readonly footer?: JSX.Element
  readonly children?: JSX.Element
  /** Where focus goes when it opens; the first focusable element by default. */
  readonly initialFocusEl?: () => HTMLElement | null
}

/**
 * A dialog with a title, a body and a footer: `<Modal open={open()} onOpenChange={setOpen} title="New user"
 * footer={...}>`. Escape, the close button and a click outside close it. For anything else,
 * compose `Dialog` parts.
 */
export const Modal = (props: ModalProps) => {
  const [local, variants] = splitProps(props, [
    "open",
    "onOpenChange",
    "title",
    "description",
    "footer",
    "children",
    "initialFocusEl",
  ])
  return (
    <Dialog.Root
      open={local.open}
      onOpenChange={(details) => local.onOpenChange(details.open)}
      initialFocusEl={local.initialFocusEl}
      // A long body scrolls between the title and the buttons, which stay in view.
      scrollBehavior="inside"
      {...variants}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{local.title}</Dialog.Title>
              <Show when={local.description}>
                <Dialog.Description>{local.description}</Dialog.Description>
              </Show>
            </Dialog.Header>
            <Show when={local.children}>
              <Dialog.Body>{local.children}</Dialog.Body>
            </Show>
            <Show when={local.footer}>
              <Dialog.Footer>{local.footer}</Dialog.Footer>
            </Show>
            <Dialog.CloseTrigger asChild={(trigger) => <CloseButton size="sm" {...trigger()} />} />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
