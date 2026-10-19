import { Kbd } from "@mosaik/mosaik-ui"
import { HStack } from "styled-system/jsx"

export const App = () => {
  return (
    <HStack gap="1">
      <Kbd>ctrl</Kbd>+<Kbd>shift</Kbd>+<Kbd>del</Kbd>
    </HStack>
  )
}
