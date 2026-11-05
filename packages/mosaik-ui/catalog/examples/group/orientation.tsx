import { Button, Group } from "@mosaik/mosaik-ui"
import { group } from "styled-system/recipes"
import { Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={group.variantMap.orientation}>
    {(orientation) => (
      <Group orientation={orientation} attached>
        <Button variant="outline">First</Button>
        <Button variant="outline">Second</Button>
        <Button variant="outline">Third</Button>
      </Group>
    )}
  </Showcase>
)
