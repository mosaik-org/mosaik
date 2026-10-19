import { Code } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const sizes = ["sm", "md", "lg", "xl"] as const
  return (
    <Stack gap="4" alignItems="start">
      <For each={sizes}>{(size) => <Code size={size}>console.log()</Code>}</For>
    </Stack>
  )
}
