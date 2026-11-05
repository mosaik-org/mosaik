import { TagsInput } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

const states = [
  { label: "Disabled", props: { disabled: true } },
  { label: "Read only", props: { readOnly: true } },
  { label: "Invalid", props: { invalid: true } },
] as const

export const App = () => (
  <Stack gap="4">
    <For each={states}>
      {(state) => (
        <TagsInput.Root defaultValue={["React", "Solid"]} {...state.props}>
          <TagsInput.Label>{state.label}</TagsInput.Label>
          <TagsInput.Control>
            <TagsInput.Items />
            <TagsInput.Input placeholder="Add tag..." />
          </TagsInput.Control>
        </TagsInput.Root>
      )}
    </For>
  </Stack>
)
