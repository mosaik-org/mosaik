import { Badge } from "@mosaik/mosaik-ui"
import StarIcon from "lucide-solid/icons/star"
import { For } from "solid-js"
import { Wrap } from "styled-system/jsx"
import { badge } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(badge.variantMap.size)
  return (
    <Wrap gap="4">
      <For each={sizes}>
        {(size) => (
          <Badge size={size}>
            <StarIcon />
            Badge
          </Badge>
        )}
      </For>
    </Wrap>
  )
}
