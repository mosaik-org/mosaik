import { Button, ConfirmDialog, Menu } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

export const App = () => {
  const [open, setOpen] = createSignal(false)

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          asChild={(triggerProps) => (
            <Button variant="outline" {...triggerProps()}>
              Actions
              <Menu.Indicator />
            </Button>
          )}
        />
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="rename">Rename</Menu.Item>
            <Menu.Item value="delete" data-danger="" onSelect={() => setOpen(true)}>
              Delete
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      {/* Outside the menu, which closes when an item is chosen, taking its items with it. */}
      <ConfirmDialog
        open={open()}
        onOpenChange={setOpen}
        title="Delete this project?"
        description="This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => setOpen(false)}
      />
    </>
  )
}
