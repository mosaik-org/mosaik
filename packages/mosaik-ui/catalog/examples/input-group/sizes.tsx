import { Input, InputGroup } from "@mosaik/mosaik-ui"
import EuroIcon from "lucide-solid/icons/euro"
import InfoIcon from "lucide-solid/icons/info"
import { For } from "solid-js/web"
import { Stack } from "styled-system/jsx"
import { inputGroup } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(inputGroup.variantMap.size)
  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <InputGroup size={size} startElement={<EuroIcon />} endElement={<InfoIcon />}>
            <Input placeholder="0.00" />
          </InputGroup>
        )}
      </For>
    </Stack>
  )
}
