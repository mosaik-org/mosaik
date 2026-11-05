import { Button, CloseButton, Dialog } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Portal } from "solid-js/web"
import { Wrap } from "styled-system/jsx"
import { dialog } from "styled-system/recipes"

export const App = () => {
  const presets = dialog.variantMap.motionPreset

  return (
    <Wrap gap="4">
      <For each={presets}>
        {(preset) => (
          <Dialog.Root motionPreset={preset}>
            <Dialog.Trigger
              asChild={(triggerProps) => (
                <Button variant="outline" {...triggerProps()}>
                  {preset}
                </Button>
              )}
            />
            <Portal>
              <Dialog.Backdrop />
              <Dialog.Positioner>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Title</Dialog.Title>
                    <Dialog.Description>Description</Dialog.Description>
                  </Dialog.Header>
                  <Dialog.Body>{/* Content */}</Dialog.Body>
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
        )}
      </For>
    </Wrap>
  )
}
