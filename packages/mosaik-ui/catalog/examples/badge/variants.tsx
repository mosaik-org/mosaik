import { Badge } from "@mosaik/mosaik-ui"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  return (
    <Wrap gap="4">
      <Badge variant="solid">Solid</Badge>
      <Badge variant="surface">Surface</Badge>
      <Badge variant="subtle">Subtle</Badge>
      <Badge variant="outline">Outline</Badge>
    </Wrap>
  )
}
