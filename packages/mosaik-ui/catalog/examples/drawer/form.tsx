import { Button, CloseButton, Drawer, TextField } from "@mosaik/mosaik-ui"
import { Portal } from "solid-js/web"
import { Stack } from "styled-system/jsx"

export const App = () => (
  <Drawer.Root>
    <Drawer.Trigger asChild={(triggerProps) => <Button {...triggerProps()}>Edit profile</Button>} />
    <Portal>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger asChild={(triggerProps) => <CloseButton {...triggerProps()} />} />
          <Drawer.Header>
            <Drawer.Title>Edit profile</Drawer.Title>
            <Drawer.Description>What others see.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <Stack gap="4">
              <TextField label="Name" />
              <TextField label="Email" type="email" />
            </Stack>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.ActionTrigger
              asChild={(triggerProps) => (
                <Button variant="outline" {...triggerProps()}>
                  Cancel
                </Button>
              )}
            />
            <Drawer.ActionTrigger asChild={(triggerProps) => <Button {...triggerProps()}>Save</Button>} />
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Portal>
  </Drawer.Root>
)
