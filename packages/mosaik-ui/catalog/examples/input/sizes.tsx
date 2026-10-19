import { Input } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const sizes = ["sm", "md", "lg", "xl"] as const
  return (
    <Stack gap="4">
      <For each={sizes}>{(size) => <Input placeholder={size} size={size} />}</For>
    </Stack>
  )
}
