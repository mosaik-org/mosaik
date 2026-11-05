import { Button, CloseButton, Drawer, Input } from "@mosaik/mosaik-ui"
import { Portal } from "solid-js/web"

export const App = () => {
  let search: HTMLInputElement | undefined

  return (
    <Drawer.Root initialFocusEl={() => search ?? null}>
      <Drawer.Trigger asChild={(triggerProps) => <Button {...triggerProps()}>Open Drawer</Button>} />
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.CloseTrigger asChild={(triggerProps) => <CloseButton {...triggerProps()} />} />
            <Drawer.Header>
              <Drawer.Title>Find a person</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <Input ref={search} placeholder="Search people" aria-label="Search people" />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
