import { Progress } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const
  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <Progress.Root size={size}>
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        )}
      </For>
    </Stack>
  )
}
