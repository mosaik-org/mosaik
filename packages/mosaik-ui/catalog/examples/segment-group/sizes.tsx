import { SegmentGroup } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const

  return (
    <Stack gap="4" alignItems="start">
      <For each={sizes}>
        {(size) => (
          <SegmentGroup.Root defaultValue="React" size={size}>
            <SegmentGroup.Indicator />
            <SegmentGroup.Items items={items} />
          </SegmentGroup.Root>
        )}
      </For>
    </Stack>
  )
}

const items = ["React", "Solid", "Svelte", "Vue"]
