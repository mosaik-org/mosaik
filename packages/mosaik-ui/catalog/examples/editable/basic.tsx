import { Editable } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Editable.Root defaultValue="Click to edit">
      <Editable.Preview />
      <Editable.Input />
    </Editable.Root>
  )
}
