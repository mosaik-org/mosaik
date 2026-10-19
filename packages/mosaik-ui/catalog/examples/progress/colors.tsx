import { Progress } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const colors = ["blue", "green", "amber", "red"] as const
  return (
    <Stack gap="4">
      <For each={colors}>
        {(color) => (
          <Progress.Root defaultValue={42} colorPalette={color}>
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        )}
      </For>
    </Stack>
  )
}
