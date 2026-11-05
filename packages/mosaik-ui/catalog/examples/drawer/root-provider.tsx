import { Button, CloseButton, Drawer } from "@mosaik/mosaik-ui"
import { Portal } from "solid-js/web"

export const App = () => {
  const drawer = Drawer.useDrawer()

  return (
    <>
      <Button variant="outline" onClick={() => drawer().setOpen(true)}>
        Open from outside
      </Button>
      <Drawer.RootProvider value={drawer}>
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
      </Drawer.RootProvider>
    </>
  )
}
