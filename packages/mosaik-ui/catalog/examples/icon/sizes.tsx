import { Icon } from "@mosaik/mosaik-ui"
import DiamondIcon from "lucide-solid/icons/diamond"
import { For } from "solid-js"
import { Wrap } from "styled-system/jsx"
import { icon } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(icon.variantMap.size)
  return (
    <Wrap gap="4">
      <For each={sizes}>
        {(size) => <Icon size={size} color="colorPalette.solid.bg" asChild={(props) => <DiamondIcon {...props()} />} />}
      </For>
    </Wrap>
  )
}
