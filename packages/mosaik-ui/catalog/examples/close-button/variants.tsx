import { CloseButton } from "@mosaik/mosaik-ui"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  return (
    <Wrap gap="4">
      <CloseButton variant="solid" />
      <CloseButton variant="surface" />
      <CloseButton variant="subtle" />
      <CloseButton variant="outline" />
      <CloseButton variant="plain" />
    </Wrap>
  )
}
