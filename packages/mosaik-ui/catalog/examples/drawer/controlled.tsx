import { Button, CloseButton, Drawer } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { Portal } from "solid-js/web"

export const App = () => {
  const [open, setOpen] = createSignal(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Drawer</Button>
      <Drawer.Root open={open()} onOpenChange={(event) => setOpen(event.open)}>
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.CloseTrigger asChild={(triggerProps) => <CloseButton {...triggerProps()} />} />
              <Drawer.Header>
                <Drawer.Title>Title</Drawer.Title>
                <Drawer.Description>Description</Drawer.Description>
              </Drawer.Header>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </>
  )
}
