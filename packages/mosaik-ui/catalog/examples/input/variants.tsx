import { Input } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const variants = ["outline", "subtle", "surface", "flushed"] as const
  return (
    <Stack gap="4">
      <For each={variants}>{(variant) => <Input placeholder={variant} variant={variant} />}</For>
    </Stack>
  )
}
