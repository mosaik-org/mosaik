import { Button, CloseButton, Dialog } from "@mosaik/mosaik-ui"
import { Portal } from "solid-js/web"
import { filler } from "../../filler"

export const App = () => {
  return (
    <Dialog.Root scrollBehavior="inside">
      <Dialog.Trigger
        asChild={(triggerProps) => (
          <Button variant="outline" {...triggerProps()}>
            Open Dialog
          </Button>
        )}
      />
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Title</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body color="fg.muted" innerHTML={filler(10)} />
            <Dialog.Footer>
              <Dialog.ActionTrigger
                asChild={(triggerProps) => (
                  <Button variant="outline" {...triggerProps()}>
                    Cancel
                  </Button>
                )}
              />
              <Dialog.ActionTrigger asChild={(triggerProps) => <Button {...triggerProps()}>Save</Button>} />
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild={(triggerProps) => <CloseButton {...triggerProps()} />} />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
