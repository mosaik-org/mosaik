import { Button } from "@mosaik/mosaik-ui"
import CircleDotIcon from "lucide-solid/icons/circle-dot"
import { For } from "solid-js"
import { Wrap } from "styled-system/jsx"
import { button } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(button.variantMap.size)

  return (
    <Wrap gap="4">
      <For each={sizes}>
        {(size) => (
          <Button size={size}>
            Button <CircleDotIcon />
          </Button>
        )}
      </For>
    </Wrap>
  )
}
