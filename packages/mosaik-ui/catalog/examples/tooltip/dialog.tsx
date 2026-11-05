import { Button, CloseButton, Dialog, Tooltip } from "@mosaik/mosaik-ui"
import { Portal } from "solid-js/web"

export const App = () => (
  <Dialog.Root>
    <Dialog.Trigger asChild={(triggerProps) => <Button {...triggerProps()}>Open Dialog</Button>} />
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Title</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Tooltip content="Shown above the dialog">
              {(trigger) => (
                <Button variant="outline" {...trigger()}>
                  Hover me
                </Button>
              )}
            </Tooltip>
          </Dialog.Body>
          <Dialog.CloseTrigger asChild={(triggerProps) => <CloseButton {...triggerProps()} />} />
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
)
