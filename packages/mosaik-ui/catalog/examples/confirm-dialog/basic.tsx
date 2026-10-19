import { Button, ConfirmDialog } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

export const App = () => {
  const [open, setOpen] = createSignal(false)
  return (
    <>
      <Button colorPalette="danger" variant="outline" onClick={() => setOpen(true)}>
        Delete user
      </Button>
      <ConfirmDialog
        open={open()}
        onOpenChange={setOpen}
        title="Delete Ada Lovelace?"
        description="She loses access to every app. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => setOpen(false)}
      />
    </>
  )
}
