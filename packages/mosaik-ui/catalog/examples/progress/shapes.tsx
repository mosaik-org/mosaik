import { Progress } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const shapes = ["rounded", "full", "square"] as const
  return (
    <Stack gap="4">
      <For each={shapes}>
        {(shape) => (
          <Progress.Root shape={shape} defaultValue={42}>
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        )}
      </For>
    </Stack>
  )
}
