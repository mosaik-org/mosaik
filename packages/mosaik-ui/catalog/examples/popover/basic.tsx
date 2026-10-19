import { Button, CloseButton, Popover } from "@mosaik/mosaik-ui"
import { Portal } from "solid-js/web"

export const App = () => {
  return (
    <Popover.Root>
      <Popover.Trigger asChild={(triggerProps) => <Button {...triggerProps()}>Open Popover</Button>} />
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Arrow />
            <Popover.Body>
              <Popover.Title>Title</Popover.Title>
              <Popover.Description>Description</Popover.Description>
            </Popover.Body>
            <Popover.CloseTrigger asChild={(triggerProps) => <CloseButton {...triggerProps()} />} />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
