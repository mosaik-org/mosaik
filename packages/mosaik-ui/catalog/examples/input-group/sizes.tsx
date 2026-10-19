import { Input, InputGroup } from "@mosaik/mosaik-ui"
import { EuroIcon, InfoIcon } from "lucide-solid"
import { For } from "solid-js/web"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const
  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <InputGroup size={size} startElement={<EuroIcon />} endElement={<InfoIcon />}>
            <Input placeholder="0.00" size={size} />
          </InputGroup>
        )}
      </For>
    </Stack>
  )
}
