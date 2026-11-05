import { Group, Input, InputAddon } from "@mosaik/mosaik-ui"
import EuroIcon from "lucide-solid/icons/euro"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"
import { inputAddon } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(inputAddon.variantMap.size)
  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <Group attached>
            <InputAddon size={size}>
              <EuroIcon />
            </InputAddon>
            <Input placeholder="0.00" size={size} />
            <InputAddon>EUR</InputAddon>
          </Group>
        )}
      </For>
    </Stack>
  )
}
