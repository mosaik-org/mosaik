import { Button, Modal, TextField } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

export const App = () => {
  const [open, setOpen] = createSignal(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New project</Button>
      <Modal
        open={open()}
        onOpenChange={setOpen}
        title="New project"
        description="Projects group the work of one team."
        footer={
          <>
            <Button variant="outline" colorPalette="gray" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Create</Button>
          </>
        }
      >
        <TextField label="Name" />
      </Modal>
    </>
  )
}
