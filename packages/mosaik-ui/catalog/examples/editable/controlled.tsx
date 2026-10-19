import { Editable } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

export const App = () => {
  const [name, setName] = createSignal("")
  return (
    <Editable.Root value={name()} onValueChange={(e) => setName(e.value)} placeholder="Click to edit">
      <Editable.Preview />
      <Editable.Input />
    </Editable.Root>
  )
}
