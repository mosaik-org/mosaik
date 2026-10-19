import { Badge, Button, Group } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => {
  return (
    <Stack gap="6">
      <Group attached>
        <Button variant="outline">Item 1</Button>
        <Button variant="outline">Item 2</Button>
      </Group>
      <Group attached>
        <Badge variant="solid">Commit status</Badge>
        <Badge variant="surface">90+</Badge>
      </Group>
    </Stack>
  )
}
