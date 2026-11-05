import { TagsInput, Text } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const [value, setValue] = createSignal(["React", "Solid"])

  return (
    <Stack gap="2">
      <TagsInput.Root value={value()} onValueChange={(event) => setValue(event.value)}>
        <TagsInput.Label>Tags</TagsInput.Label>
        <TagsInput.Control>
          <TagsInput.Items />
          <TagsInput.Input placeholder="Add tag..." />
        </TagsInput.Control>
      </TagsInput.Root>
      <Text textStyle="sm">{value().join(", ")}</Text>
    </Stack>
  )
}
