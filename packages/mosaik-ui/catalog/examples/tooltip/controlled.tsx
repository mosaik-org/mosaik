import { Button, Tooltip } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

export const App = () => {
  const [open, setOpen] = createSignal(false)
  return (
    <Tooltip content="This is the tooltip content" open={open()} onOpenChange={(e) => setOpen(e.open)}>
      <Button variant="outline" size="sm">
        {open() ? "Hide" : "Show"} Tooltip
      </Button>
    </Tooltip>
  )
}
