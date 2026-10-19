import { Progress } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const variants = ["solid", "subtle"] as const
  return (
    <Stack gap="4">
      <For each={variants}>
        {(variant) => (
          <Progress.Root defaultValue={42} variant={variant}>
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        )}
      </For>
    </Stack>
  )
}
