import { Button, Popover } from "@mosaik/mosaik-ui"
import { Portal } from "solid-js/web"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  const popover = Popover.usePopover()

  return (
    <Wrap gap="4">
      <Button variant="outline" onClick={() => popover().setOpen(true)}>
        Open from outside
      </Button>
      <Popover.RootProvider value={popover}>
        <Popover.Trigger asChild={(triggerProps) => <Button {...triggerProps()}>Popover</Button>} />
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Arrow />
              <Popover.Body>
                <Popover.Title>Title</Popover.Title>
                <Popover.Description>Description</Popover.Description>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.RootProvider>
    </Wrap>
  )
}
