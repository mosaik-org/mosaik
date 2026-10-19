import { CloseButton } from "@mosaik/mosaik-ui"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  return (
    <Wrap gap="4">
      <CloseButton size="xs" />
      <CloseButton size="sm" />
      <CloseButton size="md" />
      <CloseButton size="lg" />
      <CloseButton size="xl" />
    </Wrap>
  )
}
