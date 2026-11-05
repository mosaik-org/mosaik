import { Button, CloseButton, Dialog } from "@mosaik/mosaik-ui"
import { Portal } from "solid-js/web"

export const App = () => {
  const dialog = Dialog.useDialog()

  return (
    <>
      <Button variant="outline" onClick={() => dialog().setOpen(true)}>
        Open from outside
      </Button>
      <Dialog.RootProvider value={dialog}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Title</Dialog.Title>
                <Dialog.Description>Description</Dialog.Description>
              </Dialog.Header>
              <Dialog.CloseTrigger asChild={(triggerProps) => <CloseButton {...triggerProps()} />} />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.RootProvider>
    </>
  )
}
