import { Icon } from "@mosaik/mosaik-ui"
import { DiamondIcon } from "lucide-solid"
import { For } from "solid-js"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const
  return (
    <Wrap gap="4">
      <For each={sizes}>
        {(size) => <Icon size={size} color="colorPalette.solid.bg" asChild={(props) => <DiamondIcon {...props()} />} />}
      </For>
    </Wrap>
  )
}
