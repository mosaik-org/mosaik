import { Kbd } from "@mosaik/mosaik-ui"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  return (
    <Wrap gap="4">
      <Kbd variant="solid">⌘</Kbd>
      <Kbd variant="surface">⌘</Kbd>
      <Kbd variant="subtle">⌘</Kbd>
      <Kbd variant="outline">⌘</Kbd>
      <Kbd variant="plain">⌘</Kbd>
    </Wrap>
  )
}
