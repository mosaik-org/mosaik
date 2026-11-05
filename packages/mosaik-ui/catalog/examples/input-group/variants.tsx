import { Input, InputGroup } from "@mosaik/mosaik-ui"
import EuroIcon from "lucide-solid/icons/euro"
import InfoIcon from "lucide-solid/icons/info"
import { For } from "solid-js/web"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const variants = ["outline", "subtle", "surface", "flushed"] as const
  return (
    <Stack gap="4">
      <For each={variants}>
        {(variant) => (
          <InputGroup startElement={<EuroIcon />} endElement={<InfoIcon />}>
            <Input placeholder="0.00" variant={variant} />
          </InputGroup>
        )}
      </For>
    </Stack>
  )
}
