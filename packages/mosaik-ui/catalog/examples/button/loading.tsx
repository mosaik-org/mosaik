import { Button } from "@mosaik/mosaik-ui"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  return (
    <Wrap gap="4">
      <Button loading>Click me</Button>
      <Button loading loadingText="Saving...">
        Click me
      </Button>
    </Wrap>
  )
}
